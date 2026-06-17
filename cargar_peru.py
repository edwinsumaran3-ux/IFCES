"""
cargar_peru.py — Parser + cargador de preguntas UNT al banco de Perú
Uso: python cargar_peru.py
"""
import re, asyncio, asyncpg, pdfplumber
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
DB_URL = "postgresql://postgres:postgres@localhost:5433/icfes_db"
PDFS   = ["PERU/UNT1.pdf", "PERU/UNT.pdf"]

# ── Mapeo materia → sección ───────────────────────────────────────────────────
SECCION_MAP = {
    # Sección A — Letras / Ciencias Sociales / Humanidades
    'Desarrollo Personal': 'A', 'Ciudadanía': 'A', 'Filosofía': 'A',
    'Psicología': 'A', 'Historia del Perú': 'A', 'Historia Universal': 'A',
    'Historia': 'A', 'Geografía': 'A', 'Economía': 'A', 'Lenguaje': 'A',
    'Literatura': 'A', 'Comunicación': 'A', 'Razonamiento Verbal': 'A',
    'Inglés': 'A', 'Ética': 'A', 'Sociología': 'A', 'Ciencias Sociales': 'A',
    'Educación Cívica': 'A', 'Derecho': 'A', 'Política': 'A',
    # Sección B — Ciencias / Ingeniería / Matemática
    'Matemática': 'B', 'Física': 'B', 'Química': 'B', 'Biología': 'B',
    'Aritmética': 'B', 'Álgebra': 'B', 'Geometría': 'B', 'Trigonometría': 'B',
    'Razonamiento Matemático': 'B', 'Cálculo': 'B', 'Estadística': 'B',
    # Sección C — Ciencias de la Salud
    'Anatomía': 'C', 'Fisiología': 'C', 'Microbiología': 'C', 'Nutrición': 'C',
    # Sección D — Ciencias Agropecuarias / General
    'Agronomía': 'D', 'Zootecnia': 'D', 'Ecología': 'D', 'Medio Ambiente': 'D',
}

# Palabras clave por categoría de sección (fallback)
SEC_KEYWORDS = {
    'A': ['personal','ciudadano','cívica','social','historia','geografía','economía',
          'filosof','psicolog','lenguaje','literatura','comunicaci','inglés','ética'],
    'B': ['matemátic','física','química','biolog','álgebra','aritmét','geometr','trigon',
          'cálculo','estadíst','razonamiento mat'],
    'C': ['salud','medicina','anatomía','fisiolog','microbiol'],
    'D': ['agro','animal','ecolog','ambient','zoot'],
}

def fix_encoding(t: str) -> str:
    """Arregla caracteres especiales del PDF."""
    fixes = {
        '�': '', 'ó': 'ó', 'á': 'á', 'é': 'é', 'í': 'í', 'ú': 'ú',
        'Ó': 'Ó', 'Á': 'Á', 'É': 'É', 'Í': 'Í', 'Ú': 'Ú',
        'ñ': 'ñ', 'Ñ': 'Ñ', 'ü': 'ü', '¿': '¿', '¡': '¡',
    }
    for k, v in fixes.items():
        t = t.replace(k, v)
    # Fix doubled characters in headers (SSoolluucciioonnaarriioo → Solucionario)
    t = re.sub(r'([A-Za-z])\1', r'\1', t)
    return t

def guess_seccion(context: str) -> str:
    """Determina sección basada en el contexto."""
    ctx = context.lower()
    # Try direct keyword match
    for mat, sec in SECCION_MAP.items():
        if mat.lower() in ctx:
            return sec
    # Try category keywords
    for sec, kws in SEC_KEYWORDS.items():
        for kw in kws:
            if kw in ctx:
                return sec
    return 'A'  # default

def guess_materia(context: str) -> str:
    """Extrae la materia del contexto."""
    ctx_lower = context.lower()
    for mat in SECCION_MAP:
        if mat.lower() in ctx_lower:
            return mat
    # Try to find a capitalized phrase that looks like a subject
    m = re.search(r'Tema:\s*([^\n\.]{3,50})', context)
    if m:
        return m.group(1).strip()
    return 'General'

def extract_text_from_pdf(path: str) -> str:
    """Extrae texto completo del PDF, columna por columna."""
    all_text = []
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                w, h = page.width, page.height
                # Extract left column then right column
                for x0, x1 in [(0, w*0.52), (w*0.48, w)]:
                    col = page.crop((x0, 0, x1, h))
                    t   = col.extract_text() or ''
                    if t.strip():
                        all_text.append(t)
                all_text.append('\n')
    except Exception as e:
        print(f"  Error leyendo {path}: {e}")
    return '\n'.join(all_text)

def parse_preguntas(raw: str, source: str) -> list[dict]:
    """Parsea el texto del PDF y extrae preguntas."""
    raw = fix_encoding(raw)
    questions = []

    # Split on PREGUNTA markers (uses masculine ordinal º U+00BA)
    parts = re.split(r'PREGUNTA\s+N.{1,4}?(\d+)', raw)
    # parts = [pre, num1, block1, num2, block2, ...]

    context_window = ""  # Track last 500 chars for subject detection

    for i in range(1, len(parts), 2):
        num   = parts[i].strip()
        block = parts[i+1] if i+1 < len(parts) else ""

        # Update context from preceding text
        pre_text = parts[i-1] if i > 0 else ""
        context_window = (pre_text[-300:] + block[:300]).lower()

        # ── Extract stem (text before first A) or before RESOLUCIÓN ──────────
        stem_match = re.split(r'\nA\)', block, 1)
        if len(stem_match) < 2:
            stem_match = re.split(r'\nA\s*\)', block, 1)

        if len(stem_match) < 2:
            continue  # can't find options

        stem = stem_match[0].strip()
        after_stem = stem_match[1]

        # Remove RESOLUCIÓN from stem if present
        stem = re.split(r'RESOLUCI[ÓO]N', stem)[0].strip()
        if len(stem) < 10:
            continue

        # ── Extract options ───────────────────────────────────────────────────
        opts_text = 'A)' + after_stem
        opts_text = re.split(r'RESOLUCI[ÓO]N', opts_text)[0]

        opts: dict[str, str] = {}
        # Pattern: A) text B) text C) text etc (inline or multiline)
        opt_pattern = re.compile(r'([A-E])\)\s*(.*?)(?=[A-E]\)|$)', re.DOTALL)
        for m in opt_pattern.finditer(opts_text):
            lbl = m.group(1)
            txt = m.group(2).strip().replace('\n', ' ')
            txt = re.sub(r'\s+', ' ', txt).strip()
            if txt:
                opts[lbl] = txt

        if len(opts) < 2:
            continue  # Need at least 2 options

        # ── Extract answer ────────────────────────────────────────────────────
        resp_match = re.search(r'Respuesta:\s*([A-E])', block)
        if not resp_match:
            # Try alternate patterns
            resp_match = re.search(r'Respuesta:\s*(.{1,30})', block)
        respuesta = resp_match.group(1).strip()[:2] if resp_match else 'A'
        # Normalize to single letter
        if respuesta and respuesta[0] in 'ABCDE':
            respuesta = respuesta[0]
        else:
            respuesta = 'A'

        # ── Extract explanation ───────────────────────────────────────────────
        expl_match = re.search(r'RESOLUCI[ÓO]N\s*(.*?)(?:Respuesta:|$)', block, re.DOTALL)
        explicacion = ""
        if expl_match:
            explicacion = expl_match.group(1).strip()
            explicacion = re.sub(r'\s+', ' ', explicacion)[:500]

        # ── Determine subject and section ─────────────────────────────────────
        materia  = guess_materia(pre_text[-200:] + block[:100])
        seccion  = guess_seccion(pre_text[-300:] + block[:200])

        questions.append({
            'seccion':    seccion,
            'materia':    materia,
            'enunciado':  re.sub(r'\s+', ' ', stem)[:800],
            'opcion_a':   opts.get('A', '')[:300],
            'opcion_b':   opts.get('B', '')[:300],
            'opcion_c':   opts.get('C', '')[:300],
            'opcion_d':   opts.get('D', '')[:300],
            'respuesta':  respuesta,
            'explicacion':explicacion,
            'fuente':     source,
        })

    return questions

async def cargar(questions: list[dict]):
    """Guarda preguntas en JSON para cargar en Railway."""
    import json
    out_path = "PERU/preguntas_unt.json"
    # Keep only questions with at least 2 options and a real stem
    clean = [q for q in questions if q['opcion_a'] and q['opcion_b'] and len(q['enunciado']) > 15]
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(clean, f, ensure_ascii=False, indent=2)
    print(f"  Guardadas {len(clean)} preguntas en {out_path}")

    # Also try local DB
    try:
        conn = await asyncpg.connect(DB_URL)
        inserted = skipped = 0
        for q in clean:
            try:
                await conn.execute("""
                    INSERT INTO peru_preguntas
                        (seccion, materia, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta, explicacion)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """, q['seccion'], q['materia'], q['enunciado'],
                    q['opcion_a'], q['opcion_b'], q['opcion_c'], q['opcion_d'],
                    q['respuesta'], q['explicacion'])
                inserted += 1
            except Exception:
                skipped += 1
        await conn.close()
        print(f"  BD local: Insertadas={inserted} Saltadas={skipped}")
    except Exception as e:
        print(f"  BD local no disponible ({e}) — usar endpoint Railway")

async def main():
    all_questions = []
    for pdf_path in PDFS:
        if not Path(pdf_path).exists():
            print(f"No encontrado: {pdf_path}")
            continue
        print(f"\nLeyendo {pdf_path}...")
        raw  = extract_text_from_pdf(pdf_path)
        qs   = parse_preguntas(raw, pdf_path)
        print(f"  Preguntas extraídas: {len(qs)}")

        # Show sample
        if qs:
            q = qs[0]
            print(f"  Ejemplo — Sección {q['seccion']} | {q['materia']}")
            print(f"  Stem: {q['enunciado'][:80]}...")
            print(f"  A) {q['opcion_a'][:50]}  |  Resp: {q['respuesta']}")

        # Stats by section
        from collections import Counter
        secs = Counter(q['seccion'] for q in qs)
        mats = Counter(q['materia'] for q in qs)
        print(f"  Por sección: {dict(secs)}")
        print(f"  Top materias: {dict(list(mats.most_common(6)))}")

        all_questions.extend(qs)

    print(f"\nTotal preguntas: {len(all_questions)}")
    print("\nCargando a la base de datos...")
    await cargar(all_questions)
    print("Listo!")

if __name__ == '__main__':
    asyncio.run(main())
