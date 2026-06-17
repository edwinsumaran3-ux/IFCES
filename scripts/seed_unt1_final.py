# -*- coding: utf-8 -*-
"""
Carga preguntas_unt1_final.json a Railway (tabla peru_preguntas).
Borra las filas anteriores y recarga todo limpio.
Uso:  $env:DATABASE_URL="postgresql://..."; python scripts/seed_unt1_final.py
"""
import asyncio, json, os, sys, io
import asyncpg

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_URL  = os.environ.get('DATABASE_URL', '')
JSON_IN = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\preguntas_unt1_final.json'

INSERT = """
INSERT INTO peru_preguntas
  (materia, enunciado, opcion_a, opcion_b, opcion_c, opcion_d,
   respuesta, explicacion, seccion)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
"""

async def main():
    if not DB_URL:
        print('ERROR: set $env:DATABASE_URL primero')
        return

    data = json.load(open(JSON_IN, encoding='utf-8'))
    print(f'Cargando {len(data)} preguntas...')

    conn = await asyncpg.connect(DB_URL)
    try:
        # Limpiar tabla y recargar
        deleted = await conn.fetchval('SELECT COUNT(*) FROM peru_preguntas')
        await conn.execute('DELETE FROM peru_preguntas')
        print(f'Eliminadas {deleted or 0} filas anteriores')

        ok = 0
        for q in data:
            await conn.execute(INSERT,
                q['materia'],
                q['enunciado'],
                q.get('opcion_a',''),
                q.get('opcion_b',''),
                q.get('opcion_c',''),
                q.get('opcion_d',''),
                q['respuesta'],
                q.get('explicacion',''),
                q.get('seccion','A'),
            )
            ok += 1

        total = await conn.fetchval('SELECT COUNT(*) FROM peru_preguntas')
        print(f'OK: {ok} insertadas. Total en DB: {total}')

        # Resumen por materia
        rows = await conn.fetch(
            "SELECT materia, COUNT(*) as n FROM peru_preguntas GROUP BY materia ORDER BY n DESC"
        )
        print('\nPor materia:')
        for r in rows:
            print(f'  {r["materia"]:25s} {r["n"]}')
    finally:
        await conn.close()

asyncio.run(main())
