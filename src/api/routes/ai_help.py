# =============================================================================
#  src/api/routes/ai_help.py  — Endpoints del Modo Ayuda Socrático
# =============================================================================
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from src.ai.orchestrator import AIOrchestrator
from src.ai.schemas import AIHelpRequest, AIHelpResponse, QuestionOption
from src.infrastructure.database import get_db
from src.infrastructure.config import settings

router = APIRouter(prefix="/exam-attempts", tags=["AI Help"])

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
@router.post("/{attempt_id}/questions/{question_id}/ai-help", response_model=AIHelpResponse)
async def request_ai_help(
    attempt_id: str,
    question_id: str,
    body: AIHelpHTTPRequest,
    db=Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
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
        text("SELECT * FROM question_items WHERE id=:id"), {"id": question_id}
    )
    q_row = question.fetchone()
    if not q_row:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    # 4. Obtener opciones
    opts_result = await db.execute(
        text("SELECT label, text FROM question_options WHERE question_id=:qid ORDER BY label"),
        {"qid": question_id}
    )
    options = [QuestionOption(label=r.label, text=r.text) for r in opts_result.fetchall()]

    # 5. Descontar token de ayuda + bloquear pregunta original
    await db.execute(
        text("""
            UPDATE exam_attempts
            SET remaining_ai_helps = remaining_ai_helps - 1
            WHERE id = :id
        """),
        {"id": attempt_id}
    )
    await db.commit()

    # 6. Determinar número de ayuda
    help_number = 5 - attempt_row.remaining_ai_helps + 1

    # 7. Ejecutar AI Orchestrator
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

    response = await orchestrator.run_help_session(ai_request)

    # 8. Persistir sesión de ayuda en DB
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
        text("SELECT points FROM question_items WHERE id=:id"),
        {"id": sess_row.question_id}
    )
    q_row = q.fetchone()
    original_points = float(q_row.points) if q_row else 1.0

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
