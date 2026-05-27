# src/api/routes/exams.py — con restricciones por plan
from __future__ import annotations
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from src.infrastructure.database import get_db
try:
    from src.services.email_service import send_exam_results
except:
    send_exam_results = None

router = APIRouter(tags=["Exams"])

DISTRIBUCION_ICFES = {
    "Lectura critica":        60,
    "Matematicas":            50,
    "Ciencias naturales":     55,
    "Sociales y ciudadanas":  50,
    "Ingles":                 30,
}
TOTAL_PREGUNTAS = sum(DISTRIBUCION_ICFES.values())
DURACION_SECS   = 3 * 3600

PLAN_CONFIG = {
    'basic':   {'max_ai_helps': 1, 'difficulty': ['ALTA', 'RETO', 'MEDIA']},
    'plus':    {'max_ai_helps': 3, 'difficulty': ['ALTA', 'RETO', 'MEDIA']},
    'premium': {'max_ai_helps': 5, 'difficulty': ['RETO', 'ALTA', 'MEDIA']},
}

class StartExamRequest(BaseModel):
    student_id:     str
    student_gender: str = "neutral"
    locale:         str = "es-CO"

class AnswerRequest(BaseModel):
    question_id:     str
    selected_option: str

@router.post("/exams/start")
async def start_exam(body: StartExamRequest, db=Depends(get_db)):
    attempt_id = str(uuid4())

    # Verificar estado del plan
    user_check = (await db.execute(
        text("SELECT plan_code FROM users WHERE id=:id"),
        {"id": body.student_id}
    )).fetchone()
    if user_check and user_check.plan_code == "pending":
        raise HTTPException(
            status_code=402,
            detail="PAGO_PENDIENTE"
        )
    if user_check and user_check.plan_code == "blocked":
        raise HTTPException(
            status_code=403,
            detail="Tu plan esta bloqueado. Debes comprar un nuevo plan para presentar otro simulacro."
        )

    # Obtener plan del usuario
    user = (await db.execute(
        text("SELECT plan_code FROM users WHERE id=:id"),
        {"id": body.student_id}
    )).fetchone()
    plan_code  = (user.plan_code if user and user.plan_code else 'basic')
    plan_cfg   = PLAN_CONFIG.get(plan_code, PLAN_CONFIG['basic'])
    difficulty = plan_cfg['difficulty']
    max_helps  = plan_cfg['max_ai_helps']

    preguntas_seleccionadas = []
    for area, cantidad in DISTRIBUCION_ICFES.items():
        placeholders = ','.join([f"'{d}'" for d in difficulty])
        rows = (await db.execute(
            text(f"""
                SELECT id, codigo, area, enunciado AS stem,
                       opcion_a, opcion_b, opcion_c, opcion_d,
                       respuesta, explicacion, dificultad
                FROM preguntas_icfes
                WHERE area = :area AND dificultad IN ({placeholders})
                ORDER BY RANDOM()
                LIMIT :n
            """),
            {"area": area, "n": cantidad}
        )).fetchall()

        if len(rows) < cantidad:
            rows2 = (await db.execute(
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
            rows = rows2

        if len(rows) < cantidad:
            raise HTTPException(
                status_code=500,
                detail=f"No hay suficientes preguntas de '{area}'."
            )
        preguntas_seleccionadas.extend(rows)

    await db.execute(
        text("""
            INSERT INTO exam_attempts
                (id, student_id, student_gender, status,
                 remaining_ai_helps, score_weighted, created_at)
            VALUES
                (:id, :student_id, :gender, 'in_progress',
                 :helps, 0.0, NOW())
        """),
        {"id": attempt_id, "student_id": body.student_id,
         "gender": body.student_gender, "helps": max_helps}
    )

    for orden, row in enumerate(preguntas_seleccionadas, start=1):
        await db.execute(
            text("""
                INSERT INTO exam_attempt_questions
                    (id, attempt_id, pregunta_id, orden, answered, locked)
                VALUES (:id, :attempt_id, :pregunta_id, :orden, false, false)
            """),
            {"id": str(uuid4()), "attempt_id": attempt_id,
             "pregunta_id": row.id, "orden": orden}
        )

    await db.commit()

    return {
        "attempt_id":    attempt_id,
        "total":         TOTAL_PREGUNTAS,
        "duration_secs": DURACION_SECS,
        "plan":          plan_code,
        "max_ai_helps":  max_helps,
        "difficulty":    difficulty,
        "questions":     _build_questions(preguntas_seleccionadas),
    }


@router.get("/exam-attempts/{attempt_id}/questions")
async def get_attempt_questions(attempt_id: str, db=Depends(get_db)):
    attempt = (await db.execute(
        text("SELECT id, status FROM exam_attempts WHERE id=:id"),
        {"id": attempt_id}
    )).fetchone()
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")

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


@router.post("/exam-attempts/{attempt_id}/answers")
async def save_answer(attempt_id: str, body: AnswerRequest, db=Depends(get_db)):
    attempt = (await db.execute(
        text("SELECT id FROM exam_attempts WHERE id=:id AND status='in_progress'"),
        {"id": attempt_id}
    )).fetchone()
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")

    pregunta = (await db.execute(
        text("SELECT respuesta FROM preguntas_icfes WHERE id=:id"),
        {"id": body.question_id}
    )).fetchone()
    if not pregunta:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    is_correct = body.selected_option.upper() == pregunta.respuesta.upper()

    await db.execute(
        text("""
            INSERT INTO student_answers
                (id, attempt_id, question_id, selected_option, is_correct, answered_at)
            VALUES (:id, :attempt_id, :question_id, :option, :correct, NOW())
            ON CONFLICT (attempt_id, question_id)
            DO UPDATE SET selected_option=EXCLUDED.selected_option,
                          is_correct=EXCLUDED.is_correct, answered_at=NOW()
        """),
        {"id": str(uuid4()), "attempt_id": attempt_id,
         "question_id": body.question_id,
         "option": body.selected_option.upper(), "correct": is_correct}
    )

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


@router.post("/exam-attempts/{attempt_id}/finish")
async def finish_exam(attempt_id: str, db=Depends(get_db)):
    attempt = (await db.execute(
        text("SELECT * FROM exam_attempts WHERE id=:id"),
        {"id": attempt_id}
    )).fetchone()
    if not attempt:
        raise HTTPException(status_code=404, detail="Intento no encontrado")

    area_results = (await db.execute(
        text("""
            SELECT p.area, COUNT(*) AS total,
                   SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END) AS correct
            FROM student_answers sa
            JOIN preguntas_icfes p ON p.id = sa.question_id
            WHERE sa.attempt_id = :attempt_id
            GROUP BY p.area
        """),
        {"attempt_id": attempt_id}
    )).fetchall()

    student_row = (await db.execute(
        text("SELECT student_id FROM exam_attempts WHERE id=:id"),
        {"id": attempt_id}
    )).fetchone()
    if student_row:
        await db.execute(
            text("UPDATE users SET plan_code='blocked' WHERE id=:id"),
            {"id": str(student_row.student_id)}
        )
    await db.execute(
        text("UPDATE exam_attempts SET status='finished', finished_at=NOW() WHERE id=:id"),
        {"id": attempt_id}
    )
    await db.commit()

    # Enviar correo con resultados
    try:
        student_info = (await db.execute(
            text("SELECT email, full_name, plan_code FROM users WHERE id=:id"),
            {"id": str(student_row.student_id) if student_row else ""}
        )).fetchone()
        if student_info and send_exam_results:
            send_exam_results(
                student_email=student_info.email,
                student_name=student_info.full_name or student_info.email,
                score=float(attempt.score_weighted or 0),
                area_results=[{"area":r.area,"correct":r.correct,"total":r.total,"pct":round((r.correct/r.total)*100) if r.total else 0} for r in area_results],
                attempt_id=attempt_id,
                plan=student_info.plan_code or "basic"
            )
    except Exception as e:
        pass

    return {
        "attempt_id":     attempt_id,
        "score_weighted": float(attempt.score_weighted or 0),
        "area_results": [
            {"area": r.area, "total": r.total, "correct": r.correct,
             "pct": round((r.correct/r.total)*100) if r.total else 0}
            for r in area_results
        ],
    }


def _build_questions(rows) -> list[dict]:
    return [{
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
    } for row in rows]




