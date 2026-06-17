# -*- coding: utf-8 -*-
"""
Genera explicaciones paso a paso con IA (Claude Haiku) para las 401 preguntas
con resolución de la UNT. Actualiza la DB y guarda JSON de respaldo.
"""
import asyncio, json, os, sys, io, time
import asyncpg
import anthropic

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_URL     = os.environ.get('DATABASE_URL', '')
API_KEY    = os.environ.get('ANTHROPIC_API_KEY', '')
JSON_IN    = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\preguntas_con_resolucion.json'
JSON_OUT   = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\preguntas_con_ia.json'

PROMPT_SYS = """Eres un profesor experto en preparación de examen UNT (Universidad Nacional de Trujillo, Perú).
Explica la solución en 3 PASOS CLAROS, estilo pizarra. Usa notación simple:
- Fracciones: 1/5
- Multiplicación: ×
- Potencias: x^2
- Por lo tanto: ∴
Sé conciso. Máximo 200 palabras. NO uses LaTeX ni markdown complejo."""

def build_prompt(q: dict) -> str:
    opts = '\n'.join(f"{lbl}) {q.get(f'opcion_{lbl.lower()}','')}"
                     for lbl in ['A','B','C','D'] if q.get(f'opcion_{lbl.lower()}'))
    raw = q.get('explicacion','')[:500]
    return f"""MATERIA: {q['materia']} | TEMA: {q.get('tema','')}

PREGUNTA: {q['enunciado']}

{opts}

RESPUESTA CORRECTA: {q['respuesta']}

RESOLUCIÓN DEL PDF (puede estar garbled):
{raw}

Genera la explicación con este formato EXACTO:
DATOS: [qué datos da el problema]
PASO 1: [primer paso con fórmula o concepto]
PASO 2: [desarrollo matemático o conceptual]
PASO 3: [cálculo y resultado]
∴ La respuesta es la opción {q['respuesta']}: [valor o texto]"""

async def main():
    if not DB_URL:
        print('ERROR: Set $env:DATABASE_URL'); return
    if not API_KEY:
        print('ERROR: Set $env:ANTHROPIC_API_KEY'); return

    client = anthropic.Anthropic(api_key=API_KEY)
    data   = json.load(open(JSON_IN, encoding='utf-8'))
    print(f'Total preguntas: {len(data)}')

    # Cargar progreso anterior si existe
    done = {}
    if os.path.exists(JSON_OUT):
        prev = json.load(open(JSON_OUT, encoding='utf-8'))
        for q in prev:
            if q.get('explicacion_ia'):
                done[q['enunciado'][:60]] = q['explicacion_ia']
        print(f'Progreso anterior: {len(done)} ya generadas')

    results = []
    for i, q in enumerate(data):
        key = q['enunciado'][:60]
        if key in done:
            q['explicacion_ia'] = done[key]
            results.append(q)
            continue

        try:
            resp = client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=400,
                system=PROMPT_SYS,
                messages=[{'role':'user','content': build_prompt(q)}]
            )
            ia_text = resp.content[0].text.strip()
            q['explicacion_ia'] = ia_text
            print(f'[{i+1}/{len(data)}] Q{q["numero_pregunta"]} E{q["examen"]} OK ({len(ia_text)} chars)')
        except Exception as e:
            print(f'[{i+1}] ERROR: {e}')
            q['explicacion_ia'] = ''

        results.append(q)

        # Guardar cada 10
        if (i + 1) % 10 == 0:
            with open(JSON_OUT, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f'  Guardado parcial ({i+1}/{len(data)})')
            time.sleep(0.5)  # rate limit

    # Guardar final
    with open(JSON_OUT, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f'\nJSON guardado: {JSON_OUT}')

    # Actualizar DB — agregar columna si no existe
    conn = await asyncpg.connect(DB_URL)
    try:
        await conn.execute("""
            ALTER TABLE peru_preguntas
            ADD COLUMN IF NOT EXISTS explicacion_ia TEXT DEFAULT ''
        """)
        print('Columna explicacion_ia asegurada')

        ok = 0
        for q in results:
            if not q.get('explicacion_ia'): continue
            mat = q['materia']
            if mat == 'General': mat = 'Desarrollo Personal'
            n = await conn.execute("""
                UPDATE peru_preguntas
                SET explicacion_ia = $1
                WHERE materia = $2 AND enunciado = $3
            """, q['explicacion_ia'], mat, q['enunciado'])
            if n and n != 'UPDATE 0': ok += 1

        print(f'DB actualizada: {ok} filas')
    finally:
        await conn.close()

asyncio.run(main())
