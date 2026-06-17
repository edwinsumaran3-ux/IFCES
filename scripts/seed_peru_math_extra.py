# -*- coding: utf-8 -*-
"""
Seed Q88, Q89, Q90 (Matemática) into peru_preguntas table.
Run from the project root: python scripts/seed_peru_math_extra.py
"""
import asyncio
import json
import os
import asyncpg

DB_URL = os.environ.get("DATABASE_URL", "")

QUESTIONS = json.load(open("PERU/preguntas_matematica_extra.json", encoding="utf-8"))

INSERT_SQL = """
INSERT INTO peru_preguntas
  (materia, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta, explicacion, seccion)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT DO NOTHING
"""

async def main():
    if not DB_URL:
        print("ERROR: Set DATABASE_URL env var")
        return

    conn = await asyncpg.connect(DB_URL)
    try:
        inserted = 0
        for q in QUESTIONS:
            await conn.execute(INSERT_SQL,
                q["materia"],
                q["enunciado"],
                q["opcion_a"],
                q["opcion_b"],
                q["opcion_c"],
                q["opcion_d"],
                q["respuesta"],
                q["explicacion"],
                q["seccion"],
            )
            inserted += 1
            print(f"  Inserted Q{q['numero_pregunta']}: {q['enunciado'][:60]}...")

        total = await conn.fetchval("SELECT COUNT(*) FROM peru_preguntas WHERE materia = 'Matemática'")
        print(f"\nDone. Inserted {inserted} new questions. Total Matemática in DB: {total}")
    finally:
        await conn.close()

asyncio.run(main())
