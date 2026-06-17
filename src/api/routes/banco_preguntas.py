# src/api/routes/banco_preguntas.py — Banco de Preguntas por Materia/Tema
from __future__ import annotations
import asyncio, base64, logging, re
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from src.infrastructure.database import get_db
from src.ai.orchestrator import AIOrchestrator
from src.ai.schemas import AIHelpRequest, QuestionOption
from src.infrastructure.config import settings

logger = logging.getLogger(__name__)

# Mismas voces Neural2 que el panel de exámenes
_TTS_VOICES = {
    "female":  {"language_code": "es-US", "name": "es-US-Neural2-A"},
    "male":    {"language_code": "es-US", "name": "es-US-Neural2-B"},
    "neutral": {"language_code": "es-US", "name": "es-US-Neural2-A"},
}

router = APIRouter(tags=["Banco de Preguntas"])

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
}

MATERIAS_CONFIG: dict = {
    "Matematicas": {
        "label": "Matemáticas",
        "color": "#3fb950",
        "temas": ["Algebra", "Geometria", "Estadistica", "Aritmetica"],
    },
    "Ciencias naturales": {
        "label": "Ciencias Nat.",
        "color": "#79c0ff",
        "temas": ["Fisica", "Quimica", "Biologia"],
    },
    "Lectura critica": {
        "label": "Lectura Crítica",
        "color": "#d29922",
        "temas": ["Comprension", "Analisis", "Inferencia"],
    },
    "Sociales y ciudadanas": {
        "label": "Sociales",
        "color": "#f85149",
        "temas": ["Historia", "Geografia", "Constitucion"],
    },
    "Ingles": {
        "label": "Inglés",
        "color": "#56d364",
        "temas": ["Grammar", "Reading", "Vocabulary"],
    },
}


def get_orchestrator() -> AIOrchestrator:
    return AIOrchestrator(anthropic_key=settings.anthropic_api_key)


@router.get("/banco/materias")
async def get_materias(db=Depends(get_db)):
    result = []
    for area_key, cfg in MATERIAS_CONFIG.items():
        count_row = (await db.execute(
            text("SELECT COUNT(*) as n FROM preguntas_icfes WHERE area = :area"),
            {"area": area_key}
        )).fetchone()
        total = int(count_row.n) if count_row else 0

        # Contar por tema (si existe columna tema)
        tema_counts: dict = {}
        try:
            rows = (await db.execute(
                text("""
                    SELECT tema, COUNT(*) as n
                    FROM preguntas_icfes
                    WHERE area = :area AND tema IS NOT NULL
                    GROUP BY tema
                """),
                {"area": area_key}
            )).fetchall()
            tema_counts = {r.tema: int(r.n) for r in rows}
        except Exception:
            pass

        result.append({
            "key": area_key,
            "label": cfg["label"],
            "color": cfg["color"],
            "total": total,
            "temas": cfg["temas"],
            "tema_counts": tema_counts,
        })
    return result


@router.get("/banco/materias/{area}/preguntas")
async def get_preguntas_by_area(
    area: str,
    tema: str | None = None,
    dificultad: str | None = None,
    skip: int = 0,
    limit: int = 25,
    db=Depends(get_db),
):
    filters = ["area = :area"]
    params: dict = {"area": area, "skip": skip, "limit": min(limit, 50)}

    if tema and tema not in ("Todas", "todas", "ALL"):
        filters.append("tema = :tema")
        params["tema"] = tema
    if dificultad and dificultad not in ("Todas", "todas", "ALL", ""):
        filters.append("dificultad = :dificultad")
        params["dificultad"] = dificultad.upper()

    where = " AND ".join(filters)

    total_row = (await db.execute(
        text(f"SELECT COUNT(*) as n FROM preguntas_icfes WHERE {where}"),
        params,
    )).fetchone()

    rows = (await db.execute(
        text(f"""
            SELECT id, codigo, area, tema, enunciado,
                   opcion_a, opcion_b, opcion_c, opcion_d,
                   respuesta, explicacion, dificultad
            FROM preguntas_icfes
            WHERE {where}
            ORDER BY tema NULLS LAST, dificultad, id
            LIMIT :limit OFFSET :skip
        """),
        params,
    )).fetchall()

    return {
        "area": area,
        "total": int(total_row.n) if total_row else 0,
        "preguntas": [
            {
                "id": str(r.id),
                "codigo": r.codigo or "",
                "area": r.area,
                "tema": r.tema or "General",
                "enunciado": r.enunciado,
                "opciones": [
                    {"label": "A", "text": r.opcion_a or ""},
                    {"label": "B", "text": r.opcion_b or ""},
                    {"label": "C", "text": r.opcion_c or ""},
                    {"label": "D", "text": r.opcion_d or ""},
                ],
                "respuesta": r.respuesta,
                "explicacion": r.explicacion or "",
                "dificultad": r.dificultad or "MEDIA",
            }
            for r in rows
        ],
    }


class BancoHelpRequest(BaseModel):
    student_id: str = "banco_student"
    student_gender: str = "neutral"


@router.post("/banco/preguntas/{question_id}/explicar")
async def banco_explicar(
    question_id: str,
    body: BancoHelpRequest,
    db=Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    try:
        q = (await db.execute(
            text("""
                SELECT id, area, tema, enunciado AS stem,
                       opcion_a, opcion_b, opcion_c, opcion_d,
                       respuesta, explicacion
                FROM preguntas_icfes WHERE id = :id
            """),
            {"id": question_id},
        )).fetchone()

        if not q:
            raise HTTPException(status_code=404, detail="Pregunta no encontrada")

        req = AIHelpRequest(
            attempt_id="banco",
            question_id=str(q.id),
            student_id=body.student_id,
            question_text=q.stem,
            options=[
                QuestionOption(label="A", text=q.opcion_a or ""),
                QuestionOption(label="B", text=q.opcion_b or ""),
                QuestionOption(label="C", text=q.opcion_c or ""),
                QuestionOption(label="D", text=q.opcion_d or ""),
            ],
            area=q.area,
            student_gender=body.student_gender,
        )

        result = await orchestrator.run_help_session(req)

        return JSONResponse(
            content={
                "whiteboard": result.whiteboard.model_dump() if result.whiteboard else None,
                "audio_script": result.audio_script.model_dump() if result.audio_script else None,
                "audio_mp3_base64": result.audio_mp3_base64 or "",
                "mirror_question": result.mirror_question.model_dump() if result.mirror_question else None,
                "session_id": result.session_id,
                "latency_ms": result.latency_ms,
            },
            headers=CORS_HEADERS,
        )

    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={"detail": f"Error IA: {str(e)}"},
            headers=CORS_HEADERS,
        )


class ProgressRequest(BaseModel):
    student_id: str
    question_id: str


@router.post("/banco/progress")
async def save_progress(body: ProgressRequest, db=Depends(get_db)):
    await db.execute(
        text("""
            INSERT INTO banco_progress (student_id, question_id, viewed)
            VALUES (:sid, :qid, true)
            ON CONFLICT (student_id, question_id) DO NOTHING
        """),
        {"sid": body.student_id, "qid": body.question_id},
    )
    await db.commit()
    return {"saved": True}


@router.get("/banco/progress/{student_id}")
async def get_progress(student_id: str, db=Depends(get_db)):
    rows = (await db.execute(
        text("""
            SELECT bp.question_id, p.area, p.tema
            FROM banco_progress bp
            JOIN preguntas_icfes p ON p.id = bp.question_id
            WHERE bp.student_id = :sid AND bp.viewed = true
        """),
        {"sid": student_id},
    )).fetchall()

    by_area: dict = {}
    for r in rows:
        area = r.area or "?"
        by_area[area] = by_area.get(area, 0) + 1

    return {
        "total_viewed": len(rows),
        "by_area": by_area,
        "question_ids": [str(r.question_id) for r in rows],
    }


# ── TTS: Google Cloud TTS — voces por país y género ───────────────────────────
# NO usar gTTS: siempre produce voz femenina robótica sin control de género.
# Orden por locale: primero el acento del país, luego fallback Neural2 latino.
_VOICES = {
    # Perú
    ("pe", "male"):   [
        {"language_code": "es-PE", "name": "es-PE-Standard-B"},   # Hombre peruano
        {"language_code": "es-US", "name": "es-US-Neural2-B"},    # Fallback Neural hombre
        {"language_code": "es-US", "name": "es-US-Standard-B"},
    ],
    ("pe", "female"): [
        {"language_code": "es-PE", "name": "es-PE-Standard-A"},
        {"language_code": "es-US", "name": "es-US-Neural2-A"},
    ],
    # Colombia
    ("co", "male"):   [
        {"language_code": "es-CO", "name": "es-CO-Standard-B"},   # Hombre colombiano
        {"language_code": "es-CO", "name": "es-CO-Wavenet-B"},    # Hombre colombiano Wavenet
        {"language_code": "es-US", "name": "es-US-Neural2-B"},    # Fallback Neural hombre
        {"language_code": "es-US", "name": "es-US-Standard-B"},
    ],
    ("co", "female"): [
        {"language_code": "es-CO", "name": "es-CO-Standard-A"},
        {"language_code": "es-CO", "name": "es-CO-Wavenet-A"},
        {"language_code": "es-US", "name": "es-US-Neural2-A"},
    ],
}

def _clean_tts_text(texto: str) -> str:
    """Limpia artefactos del PDF para que el TTS suene natural."""
    import unicodedata
    t = texto
    # Símbolos matemáticos → palabras
    replacements = [
        ('∴', ' por lo tanto, '), ('→', ', entonces, '), ('≈', ' aproximadamente '),
        ('≠', ' diferente de '), ('≤', ' menor o igual a '), ('≥', ' mayor o igual a '),
        ('×', ' por '), ('÷', ' dividido entre '), ('±', ' más o menos '),
        ('°', ' grados'), ('∫', ' integral de '), ('√', ' raíz cuadrada de '),
        ('∞', ' infinito'), ('∑', ' suma de '), ('α', ' alfa'), ('β', ' beta'),
        ('γ', ' gamma'), ('δ', ' delta'), ('π', ' pi'), ('Δ', ' delta'),
        ('²', ' al cuadrado'), ('³', ' al cubo'), ('½', ' un medio'),
    ]
    for sym, word in replacements:
        t = t.replace(sym, word)
    # Artefactos PDF de doble columna (letras sueltas al inicio de línea)
    t = re.sub(r'\b(RE|Te|La|de|un|y|el|se|ma|co|ob|ste|dim|sto)\s+(?=[A-Z])', '', t)
    # "Tema: Ecuaciones." → "El tema es Ecuaciones."
    t = re.sub(r'Tema:\s*([^.]+)\.', r'El tema es \1.', t)
    # "Verdadero" y "Falso" con pausa
    t = re.sub(r'\bVerdadero\b', 'Verdadero.', t)
    t = re.sub(r'\bFalso\b', 'Falso.', t)
    # Números de página solos al final
    t = re.sub(r'\s+\d{1,3}\s*$', '.', t)
    # Múltiples espacios
    t = re.sub(r'\s{2,}', ' ', t)
    return t.strip()


class TTSRequest(BaseModel):
    text:   str
    gender: str = "male"    # "male" | "female"
    locale: str = ""        # "pe" = Perú, "co" = Colombia, "" = neutro (es-US-Neural2)


@router.post("/banco/tts")
async def banco_tts(body: TTSRequest):
    """
    Convierte texto a MP3 base64 con voz del país correspondiente.
    Perú   → es-PE-Standard-B (hombre peruano)
    Colombia → es-CO-Standard-B / Wavenet-B (hombre colombiano)
    Fallback → es-US-Neural2-B (hombre neutro-latino).
    Si Google falla devuelve audio vacío → frontend usa Web Speech.
    NUNCA usa gTTS (voz femenina robótica, sin control de género).
    """
    texto  = _clean_tts_text(re.sub(r'\s+', ' ', body.text.strip()))
    locale = (body.locale or "").lower().strip()
    gender = (body.gender or "male").lower().strip()
    # Si no viene locale (Colombia y otros), usar es-US-Neural2 (comportamiento original)
    if (locale, gender) in _VOICES or (locale, "male") in _VOICES:
        voices = _VOICES.get((locale, gender)) or _VOICES.get((locale, "male"))
    else:
        # Fallback: es-US-Neural2 (Colombia no envía locale)
        voices = [
            {"language_code": "es-US", "name": "es-US-Neural2-B" if gender == "male" else "es-US-Neural2-A"},
            {"language_code": "es-US", "name": "es-US-Standard-B" if gender == "male" else "es-US-Standard-A"},
        ]

    try:
        from google.cloud import texttospeech

        # SSML expresivo con pausas naturales y tono más grave
        t = texto
        t = re.sub(r'([.!?])\s+', r'\1 <break time="450ms"/> ', t)
        t = re.sub(r',\s+',        ', <break time="200ms"/> ', t)
        t = t.replace('&', '&amp;').replace('<break', '<break')  # escape ampersands
        ssml = (
            '<speak>'
            '<prosody rate="87%" pitch="-3st" volume="+2dB">'
            f'{t}'
            '</prosody>'
            '</speak>'
        )

        client = texttospeech.TextToSpeechClient()
        inp    = texttospeech.SynthesisInput(ssml=ssml)
        cfg    = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.88,
            pitch=-3.0,   # Más grave → más masculino
        )

        for vp in voices:
            try:
                voice = texttospeech.VoiceSelectionParams(
                    language_code=vp["language_code"],
                    name=vp["name"],
                )
                loop = asyncio.get_event_loop()
                resp = await loop.run_in_executor(
                    None, lambda v=voice: client.synthesize_speech(input=inp, voice=v, audio_config=cfg)
                )
                audio_b64 = base64.b64encode(resp.audio_content).decode("utf-8")
                logger.info(f"[banco/tts] OK voz={vp['name']} {len(texto)}ch")
                return JSONResponse(content={"audio_b64": audio_b64, "engine": vp["name"]}, headers=CORS_HEADERS)
            except Exception as e_voice:
                logger.warning(f"[banco/tts] voz {vp['name']} falló: {e_voice}")
                continue

    except Exception as e_google:
        logger.warning(f"[banco/tts] Google TTS no disponible: {e_google}")

    # Sin audio — el frontend usa Web Speech API (hombre en el browser)
    logger.info("[banco/tts] Devolviendo vacío → frontend usará Web Speech masculino")
    return JSONResponse(content={"audio_b64": "", "engine": "browser"}, headers=CORS_HEADERS)
