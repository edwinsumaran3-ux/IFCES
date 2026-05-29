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


# ── TTS: Google Cloud Neural2 (mismo sistema que exámenes) + fallback gTTS ───
# Voces Neural2 — sonido natural, sin costo adicional (ya configurado en Railway)
_NEURAL2_VOICES = {
    "female":  {"language_code": "es-US", "name": "es-US-Neural2-A", "ssml_gender": "FEMALE"},
    "male":    {"language_code": "es-US", "name": "es-US-Neural2-B", "ssml_gender": "MALE"},
    "neutral": {"language_code": "es-US", "name": "es-US-Neural2-A", "ssml_gender": "FEMALE"},
}

class TTSRequest(BaseModel):
    text:   str
    gender: str = "neutral"   # "male" | "female" | "neutral"


@router.post("/banco/tts")
async def banco_tts(body: TTSRequest):
    """
    Convierte texto a MP3 base64.
    Prioridad 1: Google Cloud TTS Neural2 (es-US-Neural2-A/B) — voz natural.
    Prioridad 2: gTTS — fallback si Google no responde.
    """
    texto = re.sub(r'\s+', ' ', body.text.strip())
    vp    = _NEURAL2_VOICES.get(body.gender, _NEURAL2_VOICES["neutral"])

    # ── Intentar Google Cloud TTS Neural2 ────────────────────────────────────
    try:
        from google.cloud import texttospeech

        # SSML con pausas naturales
        t = texto
        t = re.sub(r'\.\s+', '. <break time="420ms"/> ', t)
        t = re.sub(r'\?\s+', '? <break time="480ms"/> ', t)
        t = re.sub(r'!\s+',  '! <break time="480ms"/> ', t)
        t = re.sub(r',\s+',  ', <break time="180ms"/> ', t)
        ssml = f'<speak><prosody rate="88%" pitch="-1st">{t}</prosody></speak>'

        client = texttospeech.TextToSpeechClient()
        inp    = texttospeech.SynthesisInput(ssml=ssml)
        voice  = texttospeech.VoiceSelectionParams(
            language_code=vp["language_code"],
            name=vp["name"],
        )
        cfg = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.90,
            pitch=-1.0,
        )
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(
            None, lambda: client.synthesize_speech(input=inp, voice=voice, audio_config=cfg)
        )
        audio_b64 = base64.b64encode(resp.audio_content).decode("utf-8")
        logger.info(f"[banco/tts] Neural2 OK — {len(texto)}ch — voz={vp['name']}")
        return JSONResponse(content={"audio_b64": audio_b64, "engine": "neural2"}, headers=CORS_HEADERS)

    except Exception as e_google:
        logger.warning(f"[banco/tts] Google TTS falló: {e_google}. Usando gTTS...")

    # ── Fallback: gTTS ────────────────────────────────────────────────────────
    try:
        from gtts import gTTS
        import io as _io

        def _synth() -> bytes:
            tts = gTTS(text=texto, lang='es', slow=False)
            fp  = _io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            return fp.read()

        loop = asyncio.get_event_loop()
        audio_bytes = await loop.run_in_executor(None, _synth)
        audio_b64   = base64.b64encode(audio_bytes).decode("utf-8")
        logger.info(f"[banco/tts] gTTS OK — {len(texto)}ch")
        return JSONResponse(content={"audio_b64": audio_b64, "engine": "gtts"}, headers=CORS_HEADERS)

    except Exception as e_gtts:
        logger.error(f"[banco/tts] Ambos TTS fallaron: {e_gtts}")
        return JSONResponse(content={"audio_b64": "", "error": str(e_gtts)}, headers=CORS_HEADERS)
