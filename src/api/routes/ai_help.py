# =============================================================================
#  src/api/routes/ai_help.py  — Endpoints del Modo Ayuda Socrático
# =============================================================================
from __future__ import annotations
import json as _json
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from src.ai.orchestrator import AIOrchestrator
from src.ai.schemas import AIHelpRequest, AIHelpResponse, QuestionOption
from src.infrastructure.database import get_db
from src.infrastructure.config import settings

router = APIRouter(prefix="/exam-attempts", tags=["AI Help"])

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
}

def get_orchestrator() -> AIOrchestrator:
    return AIOrchestrator(anthropic_key=settings.anthropic_api_key)

class AIHelpHTTPRequest(BaseModel):
    student_id: str
    student_gender: str = "neutral"
    accessibility_mode: bool = False
    locale: str = "es-CO"

class MirrorAnswerRequest(BaseModel):
    selected_option: str

# ── POST /exam-attempts/{attemptId}/questions/{questionId}/ai-help ────────────
@router.post("/{attempt_id}/questions/{question_id}/ai-help")
async def request_ai_help(
    attempt_id: str,
    question_id: str,
    body: AIHelpHTTPRequest,
    db=Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    try:
        return await _handle_ai_help(attempt_id, question_id, body, db, orchestrator)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code,
                            content={"detail": e.detail},
                            headers=CORS_HEADERS)
    except Exception as e:
        return JSONResponse(status_code=502,
                            content={"detail": f"Error IA: {str(e)}"},
                            headers=CORS_HEADERS)


async def _handle_ai_help(attempt_id, question_id, body, db, orchestrator):
    # 1. Validar intento activo
    attempt = await db.execute(
        text("SELECT * FROM exam_attempts WHERE id=:id AND status='in_progress'"),
        {"id": attempt_id}
    )
    attempt_row = attempt.fetchone()
    if not attempt_row:
        raise HTTPException(status_code=404, detail="Intento no encontrado o ya finalizado")

    # 2. Validar límite de ayudas (máx. 5)
    if attempt_row.remaining_ai_helps <= 0:
        raise HTTPException(
            status_code=403,
            detail="Límite de ayudas IA alcanzado. Máximo 5 ayudas por examen."
        )

    # 3. Obtener pregunta
    question = await db.execute(
        text("""
            SELECT id, area, enunciado AS stem,
                   opcion_a, opcion_b, opcion_c, opcion_d
            FROM preguntas_icfes WHERE id=:id
        """),
        {"id": question_id}
    )
    q_row = question.fetchone()
    if not q_row:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    # 4. Construir opciones desde columnas de preguntas_icfes
    options = [
        QuestionOption(label="A", text=q_row.opcion_a),
        QuestionOption(label="B", text=q_row.opcion_b),
        QuestionOption(label="C", text=q_row.opcion_c),
        QuestionOption(label="D", text=q_row.opcion_d),
    ]

    # 5. Determinar número de ayuda
    help_number = 5 - attempt_row.remaining_ai_helps + 1

    # 6. Ejecutar AI Orchestrator
    ai_request = AIHelpRequest(
        question_id    = question_id,
        student_id     = body.student_id,
        attempt_id     = attempt_id,
        question_text  = q_row.stem,
        options        = options,
        area           = q_row.area,
        help_number    = help_number,
        student_gender = body.student_gender,
        accessibility_mode = body.accessibility_mode,
        locale         = body.locale,
    )

    try:
        response = await orchestrator.run_help_session(ai_request)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=502, detail=f"Error en servicio IA: {str(e)}") from e

    # 7. Descontar token y persistir sesión solo si la IA respondió bien
    token_update = await db.execute(
        text("""
            UPDATE exam_attempts
            SET remaining_ai_helps = remaining_ai_helps - 1
            WHERE id = :id
              AND remaining_ai_helps > 0
        """),
        {"id": attempt_id}
    )
    if token_update.rowcount != 1:
        await db.rollback()
        raise HTTPException(
            status_code=403,
            detail="Límite de ayudas IA alcanzado. Máximo 5 ayudas por examen."
        )

    await db.execute(
        text("""
            INSERT INTO ai_help_sessions
            (id, attempt_id, question_id, help_number, prompt_version,
             whiteboard_json, audio_script, mirror_question_json,
             approved, risk_level, latency_ms, created_at)
            VALUES
            (:id, :attempt_id, :question_id, :help_number, :prompt_version,
             :whiteboard_json, :audio_script, :mirror_question_json,
             :approved, :risk_level, :latency_ms, NOW())
        """),
        {
            "id":                  response.session_id,
            "attempt_id":          attempt_id,
            "question_id":         question_id,
            "help_number":         help_number,
            "prompt_version":      response.prompt_bundle_version,
            "whiteboard_json":     response.whiteboard.model_dump_json(),
            "audio_script":        response.audio_script.tts_script,
            "mirror_question_json": response.mirror_question.model_dump_json(),
            "approved":            response.approved,
            "risk_level":          response.risk_level,
            "latency_ms":          response.latency_ms,
        }
    )
    await db.commit()

    return response


# ── POST /mirror-questions/{mirrorId}/answer ──────────────────────────────────
@router.post("/mirror-questions/{session_id}/answer")
async def answer_mirror_question(
    session_id: str,
    body: MirrorAnswerRequest,
    db=Depends(get_db),
):
    # Obtener sesión
    session = await db.execute(
        text("SELECT * FROM ai_help_sessions WHERE id=:id"), {"id": session_id}
    )
    sess_row = session.fetchone()
    if not sess_row:
        raise HTTPException(status_code=404, detail="Sesión de ayuda no encontrada")

    import json as _json
    mirror_data = _json.loads(sess_row.mirror_question_json)
    correct = mirror_data.get("internal_solution", {}).get("correct_option", "")
    is_correct = body.selected_option.upper() == correct.upper()

    # Obtener puntaje original de la pregunta
    q = await db.execute(
        text("SELECT id FROM preguntas_icfes WHERE id=:id"),
        {"id": sess_row.question_id}
    )
    q_row = q.fetchone()
    original_points = 1.0

    # Regla de negocio: 50% si acierta, 0% si falla
    awarded = original_points * 0.5 if is_correct else 0.0

    # Guardar respuesta
    await db.execute(
        text("""
            UPDATE ai_help_sessions
            SET mirror_answer=:ans, mirror_correct=:correct, awarded_score=:score
            WHERE id=:id
        """),
        {"ans": body.selected_option, "correct": is_correct, "score": awarded, "id": session_id}
    )
    await db.commit()

    return {
        "is_correct":             is_correct,
        "awarded_score":          awarded,
        "original_question_locked": True,
        "feedback": (
            "Excelente razonamiento. Lograste el 50% del puntaje original."
            if is_correct else
            "Tu respuesta no alcanzó el criterio lógico esperado. Revisa los conceptos."
        ),
    }
