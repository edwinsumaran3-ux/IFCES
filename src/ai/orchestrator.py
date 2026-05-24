# =============================================================================
#  src/ai/orchestrator.py  — COMPLETO Claude + Google TTS
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
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096
MAX_REPAIRS = 2

VOICE_PROFILES = {
    "female":  {"language_code":"es-US","name":"es-US-Neural2-A","gender":"FEMALE"},
    "male":    {"language_code":"es-US","name":"es-US-Neural2-B","gender":"MALE"},
    "neutral": {"language_code":"es-US","name":"es-US-Neural2-A","gender":"FEMALE"},
}

class AIOrchestrator:
    def __init__(self, anthropic_key: str):
        self.claude   = anthropic.Anthropic(api_key=anthropic_key)
        self.registry = PromptRegistry()
        try:
            from google.cloud import texttospeech
            self.tts = texttospeech.TextToSpeechClient()
            self._tts_available = True
        except Exception:
            self.tts = None
            self._tts_available = False

    async def run_help_session(self, request: AIHelpRequest) -> AIHelpResponse:
        sid = str(uuid4())
        t0  = time.time()
        logger.info(f"[{sid}] Iniciando ayuda IA pregunta={request.question_id}")

        clf      = await self._classify(request, sid)
        plan     = await self._plan(request, clf, sid)
        wb       = await self._whiteboard(request, clf, plan, sid)
        audio_sc = await self._audio_script(wb, sid)
        mirror   = await self._mirror(request, clf, sid)
        leakage  = await self._leakage(request, wb, mirror, sid)

        for i in range(MAX_REPAIRS):
            if leakage.approved: break
            logger.warning(f"[{sid}] Reparación {i+1} — risk={leakage.risk_level}")
            wb      = await self._whiteboard(request, clf, plan, sid)
            mirror  = await self._mirror(request, clf, sid)
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
        r = self._llm(self.registry.get("task.icfes-classifier"),
            f"Clasifica esta pregunta ICFES:\n\nPREGUNTA:\n{req.question_text}\n\n"
            f"OPCIONES:\n{self._fmtopts(req.options)}\n\nDevuelve SOLO JSON válido.")
        return ICFESClassification(**self._json(r, sid, "classifier"))

    async def _plan(self, req, clf, sid):
        r = self._llm(self.registry.get("task.socratic-planner"),
            f"Diseña estrategia socrática.\n\nCLASIFICACIÓN:\n{clf.model_dump_json(indent=2)}\n\n"
            f"PREGUNTA:\n{req.question_text}\n\nDevuelve SOLO JSON válido.")
        return SocraticPlan(**self._json(r, sid, "planner"))

    async def _whiteboard(self, req, clf, plan, sid):
        r = self._llm(self.registry.get("task.whiteboard-generator"),
            f"Genera la pizarra acrílica.\n\nPREGUNTA:\n{req.question_text}\n\n"
            f"ESTRATEGIA:\n{plan.model_dump_json(indent=2)}\n\n"
            f"ÁREA: {clf.area} COMPETENCIA: {clf.competency}\n\nDevuelve SOLO JSON válido.")
        return WhiteboardOutput(**self._json(r, sid, "whiteboard"))

    async def _audio_script(self, wb, sid):
        r = self._llm(self.registry.get("task.audio-script-generator"),
            f"Convierte esta pizarra en guion TTS pedagógico.\n\n"
            f"PIZARRA:\n{wb.model_dump_json(indent=2)}\n\nDevuelve SOLO JSON válido.")
        return AudioScriptOutput(**self._json(r, sid, "audio"))

    async def _mirror(self, req, clf, sid):
        r = self._llm(self.registry.get("task.mirror-question-generator"),
            f"Genera pregunta espejo equivalente.\n\nORIGINAL:\n{req.question_text}\n\n"
            f"OPCIONES:\n{self._fmtopts(req.options)}\n\n"
            f"CLASIFICACIÓN:\n{clf.model_dump_json(indent=2)}\n\nDevuelve SOLO JSON válido.")
        return MirrorQuestion(**self._json(r, sid, "mirror"))

    async def _leakage(self, req, wb, mirror, sid):
        r = self._llm(self.registry.get("evaluator.answer-leakage"),
            f"Evalúa integridad académica.\n\nPREGUNTA ORIGINAL:\n{req.question_text}\n\n"
            f"PIZARRA:\n{wb.model_dump_json(indent=2)}\n\n"
            f"ESPEJO:\n{mirror.model_dump_json(indent=2)}\n\nDevuelve SOLO JSON válido.")
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
            resp = self.tts.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config)
            return base64.b64encode(resp.audio_content).decode("utf-8")
        except Exception as e:
            logger.error(f"[{sid}] TTS error: {e}")
            return ""

    def _llm(self, system: str, user: str) -> str:
        msg = self.claude.messages.create(
            model=MODEL, max_tokens=MAX_TOKENS,
            system=system, messages=[{"role":"user","content":user}])
        return msg.content[0].text

    def _json(self, text: str, sid: str, step: str) -> dict:
        clean = re.sub(r"```(?:json)?","", text).strip().rstrip("`").strip()
        try:
            return json.loads(clean)
        except json.JSONDecodeError as e:
            logger.error(f"[{sid}] JSON inválido en {step}: {e}")
            raise ValueError(f"JSON inválido en {step}: {e}")

    def _fmtopts(self, options: list) -> str:
        return "\n".join(
            f"{o['label'] if isinstance(o,dict) else o.label}. "
            f"{o['text'] if isinstance(o,dict) else o.text}"
            for o in options)
