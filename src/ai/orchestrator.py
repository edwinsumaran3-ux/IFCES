# =============================================================================
#  src/ai/orchestrator.py  — Claude AsyncAnthropic + Google TTS
# =============================================================================
from __future__ import annotations
import asyncio, base64, json, logging, time, re
from uuid import uuid4
import anthropic
from src.ai.prompt_registry import PromptRegistry
from src.ai.schemas import (
    AIHelpRequest, AIHelpResponse, ICFESClassification, SocraticPlan,
    WhiteboardOutput, AudioScriptOutput, MirrorQuestion, LeakageEvaluation,
)

logger = logging.getLogger(__name__)
MODEL_RICH  = "claude-sonnet-4-6"          # Pizarra — calidad máxima para el estudiante
MODEL_FAST  = "claude-haiku-4-5-20251001"  # Clasificar, planear, audio, espejo, evaluación
MAX_TOKENS  = 4096
MAX_REPAIRS = 1  # Máx 1 reparación (antes 2) para ahorrar créditos

VOICE_PROFILES = {
    "female":  {"language_code":"es-US","name":"es-US-Neural2-A","gender":"FEMALE"},
    "male":    {"language_code":"es-US","name":"es-US-Neural2-B","gender":"MALE"},
    "neutral": {"language_code":"es-US","name":"es-US-Neural2-A","gender":"FEMALE"},
}

class AIOrchestrator:
    def __init__(self, anthropic_key: str):
        self.claude   = anthropic.AsyncAnthropic(api_key=anthropic_key)
        self.registry = PromptRegistry()
        self._tts_available = False  # Google TTS desactivado; frontend usa Web Speech API

    async def run_help_session(self, request: AIHelpRequest) -> AIHelpResponse:
        sid = str(uuid4())
        t0  = time.time()
        logger.info(f"[{sid}] Iniciando ayuda IA pregunta={request.question_id}")

        # Round 1: classify → plan (secuencial, plan depende de classify)
        clf  = await self._classify(request, sid)
        plan = await self._plan(request, clf, sid)

        # Round 2: whiteboard + mirror en paralelo
        wb, mirror = await asyncio.gather(
            self._whiteboard(request, clf, plan, sid),
            self._mirror(request, clf, sid),
        )

        # Round 3: audio_script + leakage en paralelo
        audio_sc, leakage = await asyncio.gather(
            self._audio_script(request, clf, plan, wb, sid),
            self._leakage(request, wb, mirror, sid),
        )

        for i in range(MAX_REPAIRS):
            if leakage.approved: break
            logger.warning(f"[{sid}] Reparación {i+1} — risk={leakage.risk_level}")
            wb, mirror = await asyncio.gather(
                self._whiteboard(request, clf, plan, sid),
                self._mirror(request, clf, sid),
            )
            leakage = await self._leakage(request, wb, mirror, sid)


        audio_b64 = await self._tts(audio_sc, request.student_gender, sid)
        ms = int((time.time() - t0) * 1000)
        logger.info(f"[{sid}] OK en {ms}ms approved={leakage.approved}")

        return AIHelpResponse(
            session_id=sid,
            prompt_bundle_version=self.registry.current_bundle_version,
            approved=leakage.approved,
            risk_level=leakage.risk_level,
            icfes_classification=clf,
            whiteboard=wb,
            audio_script=audio_sc,
            audio_mp3_base64=audio_b64,
            mirror_question=mirror,
            latency_ms=ms,
        )

    async def _classify(self, req, sid):
        r = await self._llm_fast(self.registry.get("task.icfes-classifier"),
            f"Clasifica esta pregunta ICFES:\n\nPREGUNTA:\n{req.question_text}\n\n"
            f"OPCIONES:\n{self._fmtopts(req.options)}\n\nDevuelve SOLO JSON válido.",
            max_tokens=512)
        return ICFESClassification(**self._json(r, sid, "classifier"))

    async def _plan(self, req, clf, sid):
        r = await self._llm_fast(self.registry.get("task.socratic-planner"),
            f"Diseña estrategia socrática.\n\nCLASIFICACIÓN:\n{clf.model_dump_json()}\n\n"
            f"PREGUNTA:\n{req.question_text}\n\nDevuelve SOLO JSON válido.",
            max_tokens=900)
        data = self._json(r, sid, "planner")
        for field in ("guiding_questions", "micro_concepts", "cognitive_load_reduction", "what_to_avoid"):
            data[field] = self._as_text_list(data.get(field, []))
        return SocraticPlan(**data)

    async def _whiteboard(self, req, clf, plan, sid):
        r = await self._llm(self.registry.get("task.whiteboard-generator"),
            f"Genera la pizarra acrílica.\n\nPREGUNTA:\n{req.question_text}\n\n"
            f"OPCIONES:\n{self._fmtopts(req.options)}\n\n"
            f"ESTRATEGIA:\n{plan.model_dump_json()}\n\n"
            f"ÁREA: {clf.area} COMPETENCIA: {clf.competency}\n\nDevuelve SOLO JSON válido.")
        data = self._json(r, sid, "whiteboard")
        data = self._complete_whiteboard_data(req, clf, plan, data)
        return WhiteboardOutput(**data)

    async def _audio_script(self, req, clf, plan, wb, sid):
        r = await self._llm_fast(self.registry.get("task.audio-script-generator"),
            f"Genera el guion de audio pedagógico.\n\n"
            f"PREGUNTA ORIGINAL:\n{req.question_text}\n\n"
            f"ÁREA: {clf.area} | COMPETENCIA: {clf.competency}\n\n"
            f"ESTRATEGIA:\n{plan.opening_question} | {'; '.join(plan.guiding_questions[:2])}\n\n"
            f"BLOQUES PIZARRA:\n"
            + "\n".join(f"- {b.title}: {b.content[:80]}" for b in (wb.blue_reasoning or [])[:3])
            + "\n\nDevuelve SOLO JSON válido.",
            max_tokens=900)
        return AudioScriptOutput(**self._json(r, sid, "audio"))

    async def _mirror(self, req, clf, sid):
        r = await self._llm_fast(self.registry.get("task.mirror-question-generator"),
            f"Genera pregunta espejo equivalente.\n\nORIGINAL:\n{req.question_text}\n\n"
            f"OPCIONES:\n{self._fmtopts(req.options)}\n\n"
            f"ÁREA: {clf.area} | DIFICULTAD: {clf.difficulty_band}\n\nDevuelve SOLO JSON válido.",
            max_tokens=900)
        return MirrorQuestion(**self._json(r, sid, "mirror"))

    async def _leakage(self, req, wb, mirror, sid):
        r = await self._llm_fast(self.registry.get("evaluator.answer-leakage"),
            f"Evalúa integridad académica.\n\nPREGUNTA ORIGINAL:\n{req.question_text}\n\n"
            f"ESPEJO:\n{mirror.stem[:200]}\n\n"
            f"PIZARRA ECUACIÓN: {wb.formula.equation if wb.formula else ''}\n\nDevuelve SOLO JSON válido.",
            max_tokens=400)
        return LeakageEvaluation(**self._json(r, sid, "leakage"))

    async def _tts(self, script: AudioScriptOutput, gender: str, sid: str) -> str:
        if not self._tts_available:
            return ""
        try:
            from google.cloud import texttospeech
            ssml_text = script.tts_script.replace("[pausa breve]", '<break time="600ms"/>')
            ssml = f"<speak>{ssml_text}</speak>"
            vp = VOICE_PROFILES.get(gender, VOICE_PROFILES["neutral"])
            synthesis_input = texttospeech.SynthesisInput(ssml=ssml)
            voice = texttospeech.VoiceSelectionParams(
                language_code=vp["language_code"], name=vp["name"])
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                speaking_rate=0.92, pitch=-1.0)
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: self.tts.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config))
            return base64.b64encode(resp.audio_content).decode("utf-8")
        except Exception as e:
            logger.error(f"[{sid}] TTS error: {e}")
            return ""

    async def _llm(self, system: str, user: str) -> str:
        msg = await self.claude.messages.create(
            model=MODEL_RICH, max_tokens=MAX_TOKENS,
            system=system, messages=[{"role":"user","content":user}])
        return msg.content[0].text

    async def _llm_fast(self, system: str, user: str, max_tokens: int = 1024) -> str:
        msg = await self.claude.messages.create(
            model=MODEL_FAST, max_tokens=max_tokens,
            system=system, messages=[{"role":"user","content":user}])
        return msg.content[0].text

    def _json(self, text: str, sid: str, step: str) -> dict:
        clean = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).strip().rstrip("`").strip()
        try:
            data = json.loads(clean)
        except json.JSONDecodeError as first_error:
            try:
                data, extra_chars = self._decode_first_json(clean)
                if extra_chars:
                    logger.warning(
                        f"[{sid}] JSON en {step} traía {extra_chars} caracteres extra; se ignoraron."
                    )
            except json.JSONDecodeError as e:
                logger.error(f"[{sid}] JSON inválido en {step}: {e}\nTexto: {text[:200]}")
                raise ValueError(f"JSON inválido en paso '{step}': {first_error}") from e

        if not isinstance(data, dict):
            raise ValueError(f"JSON inválido en paso '{step}': se esperaba un objeto JSON")
        return data

    def _decode_first_json(self, text: str) -> tuple[object, int]:
        decoder = json.JSONDecoder()
        last_error: json.JSONDecodeError | None = None

        for match in re.finditer(r"[\{\[]", text):
            start = match.start()
            try:
                data, end = decoder.raw_decode(text[start:])
                extra_chars = len(text[start + end:].strip())
                return data, extra_chars
            except json.JSONDecodeError as e:
                last_error = e

        if last_error:
            raise last_error
        raise json.JSONDecodeError("No se encontró inicio de JSON", text, 0)

    def _as_text_list(self, value: object) -> list[str]:
        if not isinstance(value, list):
            return []

        items = []
        for item in value:
            if isinstance(item, str):
                items.append(item)
            elif isinstance(item, dict):
                items.append(
                    " - ".join(str(v) for v in item.values() if v is not None and str(v).strip())
                )
            elif item is not None:
                items.append(str(item))
        return items

    def _complete_whiteboard_data(self, req, clf, plan, data: dict) -> dict:
        subject_raw = (
            self._clean_text(data.get("subject"))
            or self._clean_text(getattr(clf, "area", ""))
            or self._clean_text(getattr(req, "area", ""))
        )
        subject_key = self._subject_key(subject_raw, req.question_text)
        subject = self._display_subject(subject_key) if self._is_generic_subject(subject_raw) else subject_raw
        title_raw = self._clean_text(data.get("title"))
        title = title_raw if title_raw and not self._is_generic_title(title_raw) else self._infer_board_title(req.question_text, subject)

        blue = self._as_block_list(data.get("blue_reasoning") or data.get("blue_marker_blocks"))
        if not blue:
            blue = self._default_blue_blocks(req, subject, plan)

        red = self._as_block_list(data.get("red_traps") or data.get("red_marker_blocks"), warning=True)
        if not red:
            red = self._default_red_blocks(req, subject, plan)

        formula = data.get("formula")
        if self._is_blank_formula(formula):
            formula = self._infer_formula(req.question_text)
        # Always ensure formula.steps has concrete resolution content
        formula = self._ensure_formula_steps(formula, blue, req)

        visuals = self._valid_visuals(data.get("visual_elements") or [])
        if not visuals:
            visuals = self._default_visual_elements(req, subject, formula)

        options = self._valid_options(data.get("options_analysis") or [])
        if not options:
            options = [
                {
                    "option": o["label"] if isinstance(o, dict) else o.label,
                    "status": "review",
                    "reason": f"Contrasta esta opción con el criterio azul antes de decidir: {self._short(o['text'] if isinstance(o, dict) else o.text)}",
                }
                for o in req.options
            ]

        final_close = (
            data.get("final_close")
            or data.get("final_student_instruction")
            or plan.metacognitive_prompt
            or "Antes de responder, di en voz baja cuál criterio usaste y por qué descarta las otras opciones."
        )

        return {
            **data,
            "board_style": data.get("board_style") or "school_acrylic_marker_board",
            "subject": subject,
            "title": title,
            "formula": formula,
            "blue_reasoning": blue,
            "red_traps": red,
            "visual_elements": visuals,
            "options_analysis": options,
            "final_close": final_close,
            "audio_sync_markers": data.get("audio_sync_markers") or [
                {"time_seconds": 0, "label": "Lectura", "section": "blue"},
                {"time_seconds": 35, "label": "Visual", "section": "center"},
                {"time_seconds": 80, "label": "Cierre", "section": "green"},
            ],
            "blue_marker_blocks": blue,
            "red_marker_blocks": red,
            "final_student_instruction": final_close,
        }

    def _ensure_formula_steps(self, formula: dict | None, blue: list[dict], req) -> dict:
        """Guarantee formula.steps has real content — pull from blue_reasoning if needed."""
        if formula is None:
            formula = {}

        existing = [s for s in (formula.get("steps") or []) if len(str(s).strip()) > 15
                    and not str(s).strip().endswith(":")]
        if len(existing) >= 3:
            return formula  # AI already gave good steps

        # Try to build steps from blue_reasoning blocks
        def _find_block(keywords: list[str]) -> str:
            for block in blue:
                title = block.get("title", "").lower()
                if any(k in title for k in keywords):
                    content = self._clean_text(block.get("content", ""))
                    if len(content) > 12:
                        return content
            return ""

        datos     = _find_block(["dato", "datos", "enunciado"])
        formula_s = _find_block(["fórmula", "formula", "criterio", "clave"])
        desarrollo = _find_block(["desarrollo", "paso", "aplicación", "aplicacion", "sustitución", "sustitucion"])
        verificar  = _find_block(["verific", "cómo", "como"])

        steps: list[str] = []
        if datos:     steps.append(f"DATOS: {datos}")
        if formula_s: steps.append(f"FÓRMULA: {formula_s}")
        if desarrollo:steps.append(f"DESARROLLO: {desarrollo}")
        if verificar: steps.append(f"VERIFICACIÓN: {verificar}")

        # Last resort: extract numbers from question text
        if not steps:
            nums = re.findall(r"-?\d+(?:[.,]\d+)?(?:\s*(?:cm|m|km|kg|g|s|°|%|m²|m³))?", req.question_text)
            if nums:
                steps.append(f"DATOS del enunciado: {', '.join(nums[:6])}")
            steps.append(f"PROCESO: Identifica la fórmula que aplica, sustituye los valores y opera con orden.")
            steps.append(f"VERIFICACIÓN: Revisa si el resultado tiene sentido y la unidad correcta.")

        formula["steps"] = steps if steps else existing
        return formula

    def _as_block_list(self, value: object, warning: bool = False) -> list[dict]:
        if not isinstance(value, list):
            return []

        blocks = []
        for index, item in enumerate(value, start=1):
            if isinstance(item, dict):
                title = self._clean_text(item.get("title") or item.get("concepto") or item.get("label"))
                content = self._clean_text(item.get("content") or item.get("detalle") or item.get("reason"))
                extra_key = "visual_warning" if warning else "visual_hint"
                extra = self._clean_text(item.get(extra_key) or item.get("hint"))
            else:
                title = ""
                content = self._clean_text(item)
                extra_key = "visual_warning" if warning else "visual_hint"
                extra = ""
            if not title and not content and not extra:
                continue
            title = title or f"Paso {len(blocks) + 1}"
            content = content or extra or "Observa este punto antes de responder."
            blocks.append({"order": index, "title": title, "content": content, extra_key: extra})
        return blocks

    def _blocks_from_texts(self, texts: list[str], titles: list[str], warning: bool = False) -> list[dict]:
        key = "visual_warning" if warning else "visual_hint"
        clean_texts = [t for t in texts if t and str(t).strip()]
        return [
            {"order": i + 1, "title": titles[i % len(titles)], "content": str(text), key: ""}
            for i, text in enumerate(clean_texts[:4])
        ]

    def _default_blue_blocks(self, req, subject: str, plan) -> list[dict]:
        planned = self._blocks_from_texts(
            [plan.opening_question, *plan.guiding_questions[:2], *plan.micro_concepts[:2]],
            ["Lectura precisa del enunciado", "Criterio de decisión", "Verificación paso a paso"]
        )
        if len(planned) >= 3:
            return planned[:4]

        subject_key = self._subject_key(subject, req.question_text)
        templates = {
            "geometria": [
                ("Dibuja la figura base", "Marca lados, ángulos, radios o alturas antes de operar."),
                ("Identifica relaciones", "Busca paralelismo, semejanza, Pitágoras, área, perímetro o volumen según la figura."),
                ("Conecta dato con fórmula", "Cada número del enunciado debe entrar en una parte visible del dibujo."),
                ("Verifica unidades", "Comprueba si el resultado pide longitud, área, volumen o medida angular."),
            ],
            "matematicas": [
                ("Extrae la regla", "Separa datos, variable y operación principal antes de calcular."),
                ("Sustituye con orden", "Reemplaza el valor dado y conserva signos, paréntesis y jerarquía."),
                ("Calcula por etapas", "Haz una operación por línea para evitar saltos mentales."),
                ("Contrasta opciones", "Compara el resultado o el patrón con cada opción sin adivinar."),
            ],
            "quimica": [
                ("Lee la ecuación", "Ubica sustancias antes y después de la flecha de reacción."),
                ("Clasifica sustancias", "Antes de la flecha son reactivos; después son productos."),
                ("Revisa coeficientes", "El coeficiente cambia cantidad, no el rol químico de la sustancia."),
                ("Comprueba conservación", "Compara elementos o partículas a ambos lados cuando aplique."),
            ],
            "fisica": [
                ("Identifica magnitudes", "Distingue dato, unidad y variable buscada antes de escoger fórmula."),
                ("Dibuja el sistema", "Representa fuerzas, movimiento, energía o circuito con flechas."),
                ("Relaciona unidades", "Las unidades indican qué magnitudes pueden combinarse."),
                ("Evalúa sentido físico", "El resultado debe tener dirección, signo o tamaño razonable."),
            ],
            "biologia": [
                ("Reconoce el sistema", "Identifica organismo, órgano, proceso o nivel de organización."),
                ("Ubica causa y efecto", "Conecta estímulo, mecanismo y consecuencia biológica."),
                ("Compara funciones", "Distingue estructura, función, adaptación y evidencia."),
                ("Valida con el contexto", "La respuesta debe explicar el fenómeno descrito, no solo nombrarlo."),
            ],
            "lectura": [
                ("Rastrea la idea central", "Localiza tema, propósito y postura del texto."),
                ("Usa evidencia textual", "Cada inferencia debe apoyarse en una pista del enunciado."),
                ("Distingue literal e inferido", "No confundas lo dicho explícitamente con lo que se concluye."),
                ("Evalúa intención", "Revisa tono, conector y función del fragmento."),
            ],
            "ingles": [
                ("Detecta la función comunicativa", "Identifica si se pide vocabulario, gramática, coherencia o intención."),
                ("Mira las pistas", "Conectores, tiempo verbal y contexto guían la opción."),
                ("Prueba la opción en contexto", "La frase debe sonar coherente semántica y gramaticalmente."),
                ("Descarta traducción literal", "Evita elegir solo por parecido con el español."),
            ],
            "sociales": [
                ("Ubica actores y contexto", "Reconoce época, institución, territorio o conflicto central."),
                ("Distingue causa y consecuencia", "No mezcles antecedente, proceso y efecto."),
                ("Lee la fuente", "Usa datos, mapa, gráfico o cita como evidencia."),
                ("Evalúa escala", "Diferencia nivel local, nacional, regional o global."),
            ],
        }
        return [
            {"order": i + 1, "title": title, "content": content, "visual_hint": ""}
            for i, (title, content) in enumerate(templates.get(subject_key, templates["matematicas"]))
        ]

    def _default_red_blocks(self, req, subject: str, plan) -> list[dict]:
        planned = self._blocks_from_texts(
            plan.what_to_avoid[:4],
            ["Trampa de lectura", "Distractor típico", "Error de procedimiento", "Atajo riesgoso"],
            warning=True
        )
        if len(planned) >= 2:
            return planned[:4]

        subject_key = self._subject_key(subject, req.question_text)
        templates = {
            "geometria": [
                ("Confundir medida", "No mezcles perímetro con área, ni área con volumen."),
                ("Ignorar el dibujo", "Resolver sin marcar lados o ángulos lleva a usar datos equivocados."),
                ("Usar fórmula incorrecta", "Cada figura tiene condiciones: base, altura, radio, diámetro o hipotenusa."),
            ],
            "matematicas": [
                ("Saltar jerarquía", "Operar de izquierda a derecha sin respetar paréntesis cambia el resultado."),
                ("Perder el signo", "Un signo menos puede cambiar toda la opción."),
                ("Elegir por cercanía", "Una opción parecida no prueba que el procedimiento sea correcto."),
            ],
            "quimica": [
                ("Leer la flecha al revés", "Invertir reactivos y productos cambia el sentido de la reacción."),
                ("Confundir coeficiente", "El número delante de la sustancia indica cantidad, no identidad química."),
                ("Memorizar sustancias", "La posición en la ecuación pesa más que la familiaridad del compuesto."),
            ],
            "fisica": [
                ("Olvidar unidades", "Unidades incompatibles anuncian fórmula mal aplicada."),
                ("Ignorar dirección", "Fuerza, velocidad o desplazamiento pueden requerir sentido y signo."),
                ("Copiar fórmula", "La fórmula debe corresponder al fenómeno del enunciado."),
            ],
            "biologia": [
                ("Confundir nivel biológico", "Célula, tejido, órgano y ecosistema no explican lo mismo."),
                ("Responder por palabra clave", "Una palabra familiar no basta si no coincide con el proceso."),
                ("Invertir causa y efecto", "El mecanismo debe explicar la consecuencia descrita."),
            ],
            "lectura": [
                ("Citar sin interpretar", "Repetir una frase no siempre responde la intención del autor."),
                ("Exagerar la inferencia", "La conclusión debe estar respaldada por el texto."),
                ("Ignorar conectores", "Pero, aunque, por tanto y sin embargo cambian la relación de ideas."),
            ],
            "ingles": [
                ("Traducción literal", "Una opción puede traducir parecido pero fallar en contexto."),
                ("Tiempo verbal incorrecto", "El verbo debe concordar con la situación comunicativa."),
                ("Falso cognado", "Palabras parecidas al español pueden significar otra cosa."),
            ],
            "sociales": [
                ("Anacronismo", "No atribuyas ideas o instituciones a una época que no corresponde."),
                ("Escala incorrecta", "No confundas fenómeno local con nacional o global."),
                ("Opinión sin fuente", "La respuesta debe salir de la evidencia del mapa, cita o dato."),
            ],
        }
        return [
            {"order": i + 1, "title": title, "content": content, "visual_warning": ""}
            for i, (title, content) in enumerate(templates.get(subject_key, templates["matematicas"]))
        ]

    def _infer_board_title(self, question_text: str, subject: str) -> str:
        subject_key = self._subject_key(subject, question_text)
        if re.search(r"->|→|reactivo|producto|ecuaci[oó]n qu[ií]mica", question_text, re.IGNORECASE):
            return "Ecuación química: identifica reactivos y productos"
        if subject_key == "geometria":
            return "Geometría: dibuja, marca y verifica la figura"
        if subject_key == "fisica":
            return "Física: sistema, magnitudes y sentido"
        if subject_key == "biologia":
            return "Biología: proceso, causa y evidencia"
        if subject_key == "lectura":
            return "Lectura crítica: evidencia e inferencia"
        if subject_key == "ingles":
            return "Inglés: contexto, gramática y coherencia"
        if subject_key == "sociales":
            return "Sociales: contexto, causa y consecuencia"
        if re.search(r"f\s*\(|\d+\s*[xX]|=", question_text):
            return f"{subject}: analiza la relación y sustituye con criterio"
        return f"{subject}: ruta visual de razonamiento"

    def _count_atoms(self, formula_str: str) -> list[dict]:
        """Parse 'CH4 + 2O2 → CO2 + 2H2O' and return atom-count rows."""
        sides = re.split(r'->|→', formula_str)
        if len(sides) != 2:
            return []

        def parse_side(side: str) -> dict[str, int]:
            counts: dict[str, int] = {}
            for mol in re.split(r'\+', side):
                mol = mol.strip()
                coef_m = re.match(r'^(\d+)', mol)
                coef = int(coef_m.group(1)) if coef_m else 1
                form = re.sub(r'^\d+\s*', '', mol)
                for m in re.finditer(r'([A-Z][a-z]?)(\d*)', form):
                    sym, n = m.group(1), m.group(2)
                    counts[sym] = counts.get(sym, 0) + coef * (int(n) if n else 1)
            return counts

        rct = parse_side(sides[0])
        prd = parse_side(sides[1])
        rows = []
        for sym in sorted(set(rct) | set(prd)):
            r, p = rct.get(sym, 0), prd.get(sym, 0)
            rows.append([sym, str(r), str(p), "✓" if r == p else "✗"])
        return rows

    def _infer_formula(self, question_text: str) -> dict | None:
        chemical = re.search(
            r"([A-Z][A-Za-z0-9]*(?:\s*\+\s*\d*[A-Z][A-Za-z0-9]*)+\s*(?:->|→)\s*[^?.,;\n]+)",
            question_text
        )
        if chemical:
            equation = chemical.group(1).strip()
            left, right = re.split(r"->|→", equation, maxsplit=1)
            return {
                "type": "chemical_equation",
                "equation": equation,
                "reactants": [p.strip() for p in left.split("+") if p.strip()],
                "products": [p.strip() for p in right.split("+") if p.strip()],
            }

        function = re.search(r"([A-Za-z]\([^)]*\)\s*=\s*[^,.;?]+)", question_text)
        value = re.search(r"[A-Za-z]\(([-+]?\d+(?:\.\d+)?)\)", question_text)
        if function:
            return {
                "type": "function_rule",
                "equation": function.group(1).strip(),
                "variables": {"entrada": value.group(1)} if value else {},
                "steps": ["Identifica la regla", "Sustituye la entrada", "Calcula con orden"],
            }

        expression = re.search(r"([^?.,;\n]*=\s*[^?.,;\n]+)", question_text)
        if expression:
            return {"type": "math_expression", "equation": expression.group(1).strip()}
        return None

    def _default_visual_elements(self, req, subject: str, formula: dict | None) -> list[dict]:
        visuals = []
        subject_key = self._subject_key(subject, req.question_text)
        if formula and formula.get("reactants") and formula.get("products"):
            visuals.append({
                "type": "equation_flow",
                "title": "Dirección de la reacción química",
                "caption": "Antes de la flecha = REACTIVOS. Después = PRODUCTOS.",
                "left_label": f"REACTIVOS: {' + '.join(formula['reactants'])}",
                "right_label": f"PRODUCTOS: {' + '.join(formula['products'])}",
            })
            # Atom verification table
            atom_rows = self._count_atoms(formula.get("equation", ""))
            if atom_rows:
                visuals.append({
                    "type": "comparison_table",
                    "title": "Verificación de átomos (Ley de conservación)",
                    "headers": ["Elemento", "Reactivos", "Productos", "¿Igual?"],
                    "rows": atom_rows,
                })
            visuals.append({
                "type": "comparison_table",
                "title": "Clasificación de sustancias",
                "headers": ["Sustancia", "Posición", "Rol"],
                "rows": [[x, "Antes de →", "Reactivo"] for x in formula["reactants"]]
                      + [[x, "Después de →", "Producto"] for x in formula["products"]],
            })
        elif subject_key == "quimica":
            visuals.extend([
                {
                    "type": "process_flow",
                    "title": "Lectura química del enunciado",
                    "caption": "Dibuja la transformación antes de decidir.",
                    "items": ["Sustancias iniciales", "Flecha o cambio", "Sustancias finales", "Evidencia"],
                },
                {
                    "type": "comparison_table",
                    "title": "Criterio químico",
                    "headers": ["Dato visible", "Qué significa", "Riesgo"],
                    "rows": [
                        ["Antes de la flecha", "Reactivos", "Leer al revés"],
                        ["Después de la flecha", "Productos", "Responder por memoria"],
                        ["Coeficiente", "Cantidad molecular", "Confundirlo con identidad"],
                    ],
                },
            ])
        elif subject_key == "geometria":
            visuals.extend([
                {
                    "type": "geometry_diagram",
                    "title": "Figura geométrica de referencia",
                    "caption": "La solución empieza marcando medidas en el dibujo.",
                    "shape": self._infer_geometry_shape(req.question_text),
                    "labels": ["dato", "incógnita", "relación"],
                    "items": ["Marca medidas dadas", "Ubica ángulos", "Elige fórmula correcta"],
                },
                {
                    "type": "comparison_table",
                    "title": "Qué representa cada medida",
                    "headers": ["Medida", "Pregunta clave", "Riesgo"],
                    "rows": [
                        ["Longitud", "¿Pide lado, radio, diámetro o altura?", "No es área"],
                        ["Área", "¿Pide superficie?", "No sumes bordes"],
                        ["Volumen", "¿Pide espacio ocupado?", "Requiere profundidad"],
                    ],
                },
            ])
        elif subject_key == "matematicas":
            visuals.extend([
                {
                    "type": "coordinate_plane",
                    "title": "Plano de relación",
                    "caption": "Representa entrada, cambio y salida.",
                    "items": ["Entrada", "Regla", "Salida"],
                    "points": [{"x": -2, "y": 1}, {"x": 0, "y": 2}, {"x": 2, "y": 4}],
                },
                {
                    "type": "number_line",
                    "title": "Recta de operaciones",
                    "labels": ["Dato", "Operación", "Resultado"],
                },
            ])
        elif formula and formula.get("type") in {"function_rule", "math_expression"}:
            visuals.extend([
                {
                    "type": "coordinate_plane",
                    "title": "Representación de la relación",
                    "caption": "Ubica entrada y salida para no operar a ciegas.",
                    "items": ["entrada", "regla", "salida"],
                },
                {
                    "type": "number_line",
                    "title": "Seguimiento de operaciones",
                    "labels": ["dato inicial", "operación", "resultado"],
                },
            ])
        elif subject_key == "lectura":
            visuals.extend([
                {
                    "type": "concept_map",
                    "title": "Ruta de inferencia",
                    "caption": "Una respuesta válida nace de una pista textual.",
                    "items": ["Tema", "Pista textual", "Intención", "Respuesta"],
                },
                {
                    "type": "comparison_table",
                    "title": "Evidencia vs inferencia",
                    "headers": ["Elemento", "Qué buscar", "Cómo usarlo"],
                    "rows": [
                        ["Conector", "Relación entre ideas", "Define contraste o causa"],
                        ["Tono", "Actitud del autor", "Evita interpretaciones extremas"],
                        ["Detalle", "Dato explícito", "Sostiene la inferencia"],
                    ],
                },
            ])
        elif subject_key == "ingles":
            visuals.extend([
                {
                    "type": "process_flow",
                    "title": "Prueba en contexto",
                    "caption": "La opción debe funcionar dentro de la oración.",
                    "items": ["Contexto", "Tiempo verbal", "Conector", "Opción coherente"],
                },
                {
                    "type": "comparison_table",
                    "title": "Pistas lingüísticas",
                    "headers": ["Pista", "Función", "Cuidado"],
                    "rows": [
                        ["Verbo", "Tiempo y concordancia", "No traducir literal"],
                        ["Conector", "Relación lógica", "Contraste o causa"],
                        ["Pronombre", "Referencia", "Quién hace la acción"],
                    ],
                },
            ])
        elif subject_key == "sociales":
            visuals.extend([
                {
                    "type": "timeline",
                    "title": "Secuencia histórica o social",
                    "caption": "Ordena contexto, causa, proceso y consecuencia.",
                    "items": ["Contexto", "Causa", "Proceso", "Consecuencia"],
                },
                {
                    "type": "concept_map",
                    "title": "Relación actor - hecho - efecto",
                    "items": ["Actor", "Interés", "Acción", "Impacto"],
                },
            ])
        elif subject_key in {"fisica", "biologia"}:
            visuals.extend([
                {
                    "type": "system_diagram",
                    "title": "Sistema y relaciones",
                    "caption": "Separa entrada, proceso, salida y evidencia observada.",
                    "items": ["Entrada", "Proceso", "Salida", "Evidencia"],
                },
                {
                    "type": "bar_chart",
                    "title": "Comparación visual de magnitudes",
                    "labels": ["Dato", "Proceso", "Resultado"],
                    "values": [35, 70, 55],
                },
            ])
        else:
            visuals.append({
                "type": "process_flow",
                "title": "Ruta de decisión",
                "items": ["Leer dato clave", "Aplicar criterio", "Verificar opción"],
            })
            visuals.append({
                "type": "comparison_table",
                "title": "Opciones a contrastar",
                "headers": ["Opción", "Texto", "Qué verificar"],
                "rows": [
                    [
                        o["label"] if isinstance(o, dict) else o.label,
                        self._short(o["text"] if isinstance(o, dict) else o.text, 42),
                        "Cumple el criterio azul",
                    ]
                    for o in req.options
                ],
            })
        return visuals

    def _valid_visuals(self, value: object) -> list[dict]:
        if not isinstance(value, list):
            return []
        valid = []
        for item in value:
            if not isinstance(item, dict):
                continue
            visual_type = self._clean_text(item.get("type"))
            content_keys = ("left_label", "right_label", "rows", "labels", "values", "items", "points", "shape", "caption")
            useful = any(item.get(key) for key in content_keys)
            if visual_type and useful and not self._is_generic_visual(item):
                valid.append(item)
        return valid

    def _valid_options(self, value: object) -> list[dict]:
        if not isinstance(value, list):
            return []
        valid = []
        for item in value:
            if not isinstance(item, dict):
                continue
            option = self._clean_text(item.get("option"))
            reason = self._clean_text(item.get("reason"))
            if option and reason:
                valid.append({**item, "option": option, "reason": reason, "status": self._clean_text(item.get("status")) or "review"})
        return valid

    def _is_blank_formula(self, formula: object) -> bool:
        if not isinstance(formula, dict):
            return True
        return not any(formula.get(key) for key in ("type", "equation", "reactants", "products", "variables", "steps"))

    def _is_generic_visual(self, item: dict) -> bool:
        visual_type = self._clean_text(item.get("type")).lower()
        title = self._clean_text(item.get("title")).lower()
        left = self._clean_text(item.get("left_label")).lower()
        right = self._clean_text(item.get("right_label")).lower()
        items = [self._clean_text(x).lower() for x in item.get("items", []) if self._clean_text(x)]
        generic_words = {"icfes", "datos", "dato", "criterio", "respuesta", "inicio", "resultado"}

        if visual_type in {"process_flow", "concept_map", "timeline", "system_diagram"} and len(items) < 2:
            return True
        if visual_type == "equation_flow":
            labels = {label for label in (left, right) if label}
            if labels and labels.issubset(generic_words) and "química" not in title and "quimica" not in title:
                return True
        if title in {"", "icfes", "mapa visual del problema"} and not items and not item.get("rows") and not item.get("points"):
            return True
        return False

    def _subject_key(self, subject: str, question_text: str) -> str:
        text = f"{subject} {question_text}".lower()
        if re.search(r"tri[aá]ngulo|círculo|circulo|rect[aá]ngulo|pol[ií]gono|ángulo|angulo|per[ií]metro|[áa]rea|volumen|radio|di[aá]metro|hipotenusa", text):
            return "geometria"
        if re.search(r"qu[ií]mica|reactivo|producto|mol[eé]cula|[a-z][0-9].*(->|→)", text):
            return "quimica"
        if re.search(r"f[ií]sica|fuerza|velocidad|aceleraci[oó]n|energ[ií]a|circuito|voltaje|masa", text):
            return "fisica"
        if re.search(r"biolog|c[eé]lula|ecosistema|gen|órgano|organo|prote[ií]na|evoluci[oó]n", text):
            return "biologia"
        if re.search(r"lectura|texto|autor|infer|argumento|tesis|p[aá]rrafo", text):
            return "lectura"
        if re.search(r"ingl[eé]s|english|verb|sentence|word|grammar|reading", text):
            return "ingles"
        if re.search(r"sociales|ciudadan|historia|geograf|constituci[oó]n|estado|mapa|territorio", text):
            return "sociales"
        return "matematicas"

    def _infer_geometry_shape(self, question_text: str) -> str:
        text = question_text.lower()
        if re.search(r"círculo|circulo|radio|di[aá]metro|circunferencia", text):
            return "circle"
        if re.search(r"rect[aá]ngulo|cuadrado|paralelogramo", text):
            return "rectangle"
        if re.search(r"cono|cilindro|esfera|prisma|pir[aá]mide", text):
            return "solid"
        return "triangle"

    def _display_subject(self, subject_key: str) -> str:
        return {
            "geometria": "Geometría",
            "matematicas": "Matemáticas",
            "quimica": "Química",
            "fisica": "Física",
            "biologia": "Biología",
            "lectura": "Lectura crítica",
            "ingles": "Inglés",
            "sociales": "Sociales",
        }.get(subject_key, "Razonamiento ICFES")

    def _is_generic_subject(self, subject: str) -> bool:
        normalized = self._clean_text(subject).lower()
        return normalized in {"", "icfes", "saber 11", "prueba icfes", "general", "razonamiento"}

    def _is_generic_title(self, title: str) -> bool:
        normalized = self._clean_text(title).lower()
        return normalized in {
            "",
            "pizarra acrilica de razonamiento",
            "pizarra acrílica de razonamiento",
            "mapa visual del problema",
            "icfes",
        }

    def _clean_text(self, value: object) -> str:
        return re.sub(r"\s+", " ", str(value or "")).strip()

    def _short(self, text: str, max_len: int = 58) -> str:
        text = re.sub(r"\s+", " ", str(text)).strip()
        return text if len(text) <= max_len else text[: max_len - 1].rstrip() + "…"

    def _fmtopts(self, options: list) -> str:
        return "\n".join(
            f"{o['label'] if isinstance(o,dict) else o.label}. "
            f"{o['text'] if isinstance(o,dict) else o.text}"
            for o in options)
