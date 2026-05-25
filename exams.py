# =============================================================================
#  src/api/routes/exams.py  — Gestión de simulacros e intentos de examen
#
#  Endpoints:
#    POST /exams/start          → crea intento y selecciona 245 preguntas
#    GET  /exam-attempts/{id}/questions → devuelve preguntas del intento
#    POST /exam-attempts/{id}/answers   → guarda respuesta individual
#    POST /exam-attempts/{id}/finish    → cierra intento y calcula puntaje
# =============================================================================
from __future__ import annotations
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from src.infrastructure.database import get_db

router = APIRouter(tags=["Exams"])

# ---------------------------------------------------------------------------
# Distribución oficial ICFES Saber 11 — 245 preguntas
# ---------------------------------------------------------------------------
DISTRIBUCION_ICFES = {
    "Lectura critica":        60,   # área más pesada
    "Matematicas":            50,
    "Ciencias naturales":     55,
    "Sociales y ciudadanas":  50,
    "Ingles":                 30,
}
TOTAL_PREGUNTAS = sum(DISTRIBUCION_ICFES.values())   # 245
DURACION_SECS   = 3 * 3600                            # 3 horas


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class StartExamRequest(BaseModel):
    student_id:     str
    student_gender: str = "neutral"   # male | female | neutral
    locale:         str = "es-CO"

class AnswerRequest(BaseModel):
    question_id:     str
    selected_option: str              # A, B, C o D


# ---------------------------------------------------------------------------
# POST /exams/start
# ---------------------------------------------------------------------------
@router.post("/exams/start")
async def start_exam(body: StartExamRequest, db=Depends(get_db)):
    """
    1. Selecciona 245 preguntas aleatorias de preguntas_icfes
       respetando la distribución oficial por área.
    2. Crea el intento en exam_attempts.
    3. Crea los ítems del intento en exam_attempt_questions.
    4. Devuelve attempt_id + preguntas listas para el frontend.
    """
    attempt_id = str(uuid4())

    # ── 1. Seleccionar preguntas por área ─────────────────────────────────
    preguntas_seleccionadas = []

    for area, cantidad in DISTRIBUCION_ICFES.items():
        rows = (await db.execute(
            text("""
                SELECT id, codigo, area, enunciado AS stem,
                       opcion_a, opcion_b, opcion_c, opcion_d,
                       respuesta, explicacion, dificultad
                FROM preguntas_icfes
                WHERE area = :area
                ORDER BY RANDOM()
                LIMIT :n
            """),
            {"area": area, "n": cantidad}
        )).fetchall()

        if len(rows) < cantidad:
            raise HTTPException(
                status_code=500,
                detail=f"No hay suficientes preguntas de '{area}' en la base de datos. "
                       f"Se necesitan {cantidad}, hay {len(rows)}."
            )

        preguntas_seleccionadas.extend(rows)

    # ── 2. Crear intento ──────────────────────────────────────────────────
    await db.execute(
        text("""
            INSERT INTO exam_attempts
                (id, student_id, student_gender, status,
                 remaining_ai_helps, score_weighted, created_at)
            VALUES
                (:id, :student_id, :gender, 'in_progress',
                 5, 0.0, NOW())
        """),
        {"id": attempt_id, "student_id": body.student_id, "gender": body.student_gender}
    )

    # ── 3. Guardar ítems del intento ──────────────────────────────────────
    for orden, row in enumerate(preguntas_seleccionadas, start=1):
        item_id = str(uuid4())
        await db.execute(
            text("""
                INSERT INTO exam_attempt_questions
                    (id, attempt_id, pregunta_id, orden, answered, locked)
                VALUES
                    (:id, :attempt_id, :pregunta_id, :orden, false, false)
            """),
            {"id": item_id, "attempt_id": attempt_id,
             "pregunta_id": row.id, "orden": orden}
        )

    await db.commit()

    # ── 4. Construir respuesta ────────────────────────────────────────────
    questions = _build_questions(preguntas_seleccionadas)

    return {
        "attempt_id":    attempt_id,
        "total":         TOTAL_PREGUNTAS,
        "duration_secs": DURACION_SECS,
        "questions":     questions,
    }


# ---------------------------------------------------------------------------
# GET /exam-attempts/{attempt_id}/questions
# ---------------------------------------------------------------------------
@router.get("/exam-attempts/{attempt_id}/questions")
async def get_attempt_questions(attempt_id: str, db=Depends(get_db)):
    """
    Devuelve las preguntas asociadas al intento (usado al recargar la página).
    """
    # Validar intento
    attempt = (await db.execute(
        text("SELECT id, status FROM exam_attempts WHERE id=:id"),
        {"id": attempt_id}
    )).fetchone()

    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")

    # Obtener preguntas en orden
    rows = (await db.execute(
        text("""
            SELECT p.id, p.codigo, p.area, p.enunciado AS stem,
                   p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d,
                   p.respuesta, p.explicacion, p.dificultad,
                   aq.orden, aq.locked
            FROM exam_attempt_questions aq
            JOIN preguntas_icfes p ON p.id = aq.pregunta_id
            WHERE aq.attempt_id = :attempt_id
            ORDER BY aq.orden
        """),
        {"attempt_id": attempt_id}
    )).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No hay preguntas para este intento")

    return {
        "attempt_id": attempt_id,
        "status":     attempt.status,
        "questions":  _build_questions(rows),
    }


# ---------------------------------------------------------------------------
# POST /exam-attempts/{attempt_id}/answers
# ---------------------------------------------------------------------------
@router.post("/exam-attempts/{attempt_id}/answers")
async def save_answer(attempt_id: str, body: AnswerRequest, db=Depends(get_db)):
    """Guarda la respuesta del estudiante para una pregunta."""
    # Verificar intento activo
    attempt = (await db.execute(
        text("SELECT id FROM exam_attempts WHERE id=:id AND status='in_progress'"),
        {"id": attempt_id}
    )).fetchone()
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado o ya finalizado")

    # Obtener respuesta correcta
    pregunta = (await db.execute(
        text("SELECT respuesta, id FROM preguntas_icfes WHERE id=:id"),
        {"id": body.question_id}
    )).fetchone()
    if not pregunta:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    is_correct = body.selected_option.upper() == pregunta.respuesta.upper()

    # Upsert en student_answers
    await db.execute(
        text("""
            INSERT INTO student_answers
                (id, attempt_id, question_id, selected_option, is_correct, answered_at)
            VALUES
                (:id, :attempt_id, :question_id, :option, :correct, NOW())
            ON CONFLICT (attempt_id, question_id)
            DO UPDATE SET
                selected_option = EXCLUDED.selected_option,
                is_correct      = EXCLUDED.is_correct,
                answered_at     = NOW()
        """),
        {
            "id":          str(uuid4()),
            "attempt_id":  attempt_id,
            "question_id": body.question_id,
            "option":      body.selected_option.upper(),
            "correct":     is_correct,
        }
    )

    # Actualizar puntaje ponderado del intento
    await db.execute(
        text("""
            UPDATE exam_attempts
            SET score_weighted = (
                SELECT COUNT(*) * 100.0 / :total
                FROM student_answers
                WHERE attempt_id = :attempt_id AND is_correct = true
            )
            WHERE id = :attempt_id
        """),
        {"attempt_id": attempt_id, "total": TOTAL_PREGUNTAS}
    )
    await db.commit()

    return {"saved": True, "is_correct": is_correct}


# ---------------------------------------------------------------------------
# POST /exam-attempts/{attempt_id}/finish
# ---------------------------------------------------------------------------
@router.post("/exam-attempts/{attempt_id}/finish")
async def finish_exam(attempt_id: str, db=Depends(get_db)):
    """Cierra el intento y devuelve el puntaje final."""
    attempt = (await db.execute(
        text("SELECT * FROM exam_attempts WHERE id=:id"),
        {"id": attempt_id}
    )).fetchone()
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")

    # Calcular resultados por área
    area_results = (await db.execute(
        text("""
            SELECT p.area,
                   COUNT(*)                                          AS total,
                   SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)  AS correct
            FROM student_answers sa
            JOIN preguntas_icfes p ON p.id = sa.question_id
            WHERE sa.attempt_id = :attempt_id
            GROUP BY p.area
        """),
        {"attempt_id": attempt_id}
    )).fetchall()

    # Cerrar intento
    await db.execute(
        text("""
            UPDATE exam_attempts
            SET status='finished', finished_at=NOW()
            WHERE id=:id
        """),
        {"id": attempt_id}
    )
    await db.commit()

    return {
        "attempt_id":    attempt_id,
        "score_weighted": float(attempt.score_weighted or 0),
        "area_results": [
            {
                "area":     r.area,
                "total":    r.total,
                "correct":  r.correct,
                "pct":      round((r.correct / r.total) * 100) if r.total else 0,
            }
            for r in area_results
        ],
    }


# ---------------------------------------------------------------------------
# Helper: convertir filas DB → formato que espera ExamEngine.tsx
# ---------------------------------------------------------------------------
def _build_questions(rows) -> list[dict]:
    questions = []
    for row in rows:
        questions.append({
            "id":     str(row.id),
            "stem":   row.stem,
            "area":   row.area,
            "points": 1.0,
            "options": [
                {"label": "A", "text": row.opcion_a},
                {"label": "B", "text": row.opcion_b},
                {"label": "C", "text": row.opcion_c},
                {"label": "D", "text": row.opcion_d},
            ],
        })
    return questions
