from __future__ import annotations
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from src.infrastructure.database import get_db

router = APIRouter(prefix="/peru/exams", tags=["Peru Exams"])

# Secciones válidas y qué secciones-letra incluyen
SECCION_MAP: dict[str, list[str]] = {
    "A":    ["A"],
    "B":    ["B"],
    "C":    ["C"],
    "D":    ["D"],
    "AB":   ["A", "B"],
    "BC":   ["B", "C"],
    "ABCD": ["A", "B", "C", "D"],
}

DURACION_POR_SECCION: dict[str, int] = {
    "A":    2700,   # 45 min
    "B":    2700,
    "C":    2700,
    "D":    2700,
    "AB":   5400,   # 90 min
    "BC":   5400,
    "ABCD": 10800,  # 3 h
}

class StartRequest(BaseModel):
    student_id:     str
    seccion:        str          # A | B | C | D | AB | BC | ABCD
    student_gender: str = "male"
    locale:         str = "es-PE"

@router.post("/start")
async def start_exam(body: StartRequest, db=Depends(get_db)):
    seccion = body.seccion.upper().strip()
    if seccion not in SECCION_MAP:
        raise HTTPException(status_code=400, detail=f"Sección inválida. Opciones: {list(SECCION_MAP.keys())}")

    letras      = SECCION_MAP[seccion]
    placeholders = ",".join(f":s{i}" for i in range(len(letras)))
    params       = {f"s{i}": l for i, l in enumerate(letras)}

    rows = (await db.execute(
        text(f"""
            SELECT
                id::text           AS id,
                enunciado          AS stem,
                materia            AS area,
                seccion,
                1                  AS points,
                opcion_a, opcion_b, opcion_c, opcion_d,
                respuesta
            FROM peru_preguntas
            WHERE seccion = ANY(ARRAY[{placeholders}]::text[])
            ORDER BY seccion, random()
        """),
        params
    )).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No hay preguntas registradas para esta sección aún. El banco se cargará pronto.")

    questions = []
    for r in rows:
        opts = []
        for lbl, txt in [("A", r.opcion_a), ("B", r.opcion_b), ("C", r.opcion_c), ("D", r.opcion_d)]:
            if txt:
                opts.append({"label": lbl, "text": txt})
        questions.append({
            "id":      r.id,
            "stem":    r.stem,
            "area":    r.area or "General",
            "seccion": r.seccion,
            "points":  1,
            "options": opts,
        })

    attempt_id = str(uuid.uuid4())
    duration   = DURACION_POR_SECCION.get(seccion, 3600)

    try:
        await db.execute(text("""
            INSERT INTO peru_intentos (id, student_id, seccion, status, total_questions)
            VALUES (:id, :sid, :sec, 'in_progress', :total)
        """), {"id": attempt_id, "sid": body.student_id, "sec": seccion, "total": len(questions)})
        await db.commit()
    except Exception:
        pass  # tabla puede no existir todavía, no bloqueamos

    return {
        "attempt_id":    attempt_id,
        "seccion":       seccion,
        "questions":     questions,
        "duration_secs": duration,
    }

@router.post("/submit/{attempt_id}")
async def submit_exam(attempt_id: str, db=Depends(get_db)):
    try:
        await db.execute(text("""
            UPDATE peru_intentos SET status='finished', finished_at=NOW()
            WHERE id=:id
        """), {"id": attempt_id})
        await db.commit()
    except Exception:
        pass
    return {"ok": True}
