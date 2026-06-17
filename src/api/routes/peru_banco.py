from __future__ import annotations
from fastapi import APIRouter, Query
from sqlalchemy import text
from src.infrastructure.database import get_db
from fastapi import Depends

router = APIRouter(prefix="/peru/banco", tags=["Peru Banco"])

MATERIA_COLOR: dict[str, str] = {
    "matemática":        "#16a34a",
    "matemáticas":       "#16a34a",
    "matemático":        "#16a34a",
    "física":            "#0ea5e9",
    "química":           "#f59e0b",
    "biología":          "#10b981",
    "comunicaci":        "#2563eb",
    "comunicación":      "#2563eb",
    "literatura":        "#7c3aed",
    "ciudadan":          "#dc2626",
    "ciudadanía":        "#dc2626",
    "ciudadanos":        "#dc2626",
    "ciudadano":         "#dc2626",
    "desarrollo personal": "#ca8a04",
    "historia":          "#0d9488",
    "geografía":         "#0d9488",
    "filosofía":         "#6366f1",
    "filosof":           "#6366f1",
    "econom":            "#f97316",
    "lenguaje":          "#a855f7",
    "inglés":            "#06b6d4",
    "ingles":            "#06b6d4",
    "general":           "#475569",
}

def get_color(materia: str) -> str:
    m = materia.lower()
    for k, v in MATERIA_COLOR.items():
        if k in m:
            return v
    return "#475569"


@router.get("/materias")
async def list_materias(db=Depends(get_db)):
    rows = (await db.execute(text("""
        SELECT materia, COUNT(*) as total
        FROM peru_preguntas
        GROUP BY materia
        ORDER BY total DESC
    """))).fetchall()

    result = []
    for r in rows:
        label = r.materia or "General"
        result.append({
            "key":   label,
            "label": label,
            "color": get_color(label),
            "total": r.total,
            "temas": [label],
            "tema_counts": {label: r.total},
        })
    return result


@router.get("/materias/{materia}/preguntas")
async def list_preguntas(
    materia: str,
    skip:  int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
):
    rows = (await db.execute(text("""
        SELECT id::text, materia, enunciado,
               opcion_a, opcion_b, opcion_c, opcion_d,
               respuesta, explicacion,
               COALESCE(explicacion_ia, '') as explicacion_ia,
               seccion
        FROM peru_preguntas
        WHERE materia = :mat
        ORDER BY id
        LIMIT :lim OFFSET :skip
    """), {"mat": materia, "lim": limit, "skip": skip})).fetchall()

    total_row = (await db.execute(
        text("SELECT COUNT(*) FROM peru_preguntas WHERE materia = :mat"),
        {"mat": materia}
    )).scalar()

    preguntas = []
    for i, r in enumerate(rows):
        opciones = []
        for lbl, txt in [("A", r.opcion_a), ("B", r.opcion_b), ("C", r.opcion_c), ("D", r.opcion_d)]:
            if txt:
                opciones.append({"label": lbl, "text": txt})
        preguntas.append({
            "id":         r.id,
            "codigo":     f"PE-{skip + i + 1:04d}",
            "area":       r.materia or "General",
            "tema":       r.materia or "General",
            "seccion":    r.seccion or "A",
            "enunciado":  r.enunciado,
            "opciones":   opciones,
            "respuesta":  r.respuesta or "A",
            "explicacion": r.explicacion or "",
            "explicacion_ia": r.explicacion_ia or "",
            "dificultad": "MEDIA",
        })

    return {"preguntas": preguntas, "total": total_row or 0}
