"""
parse_unt2.py — Parser completo UNT1.pdf
Sección 1 (pags 3-50): UNT 2025-I con RESOLUCIÓN paso a paso
Sección 2 (pags 77-200 + 201+): UNT 2025-II preguntas + respuestas separadas
"""
import pdfplumber, re, json, unicodedata, sys

def normalize_cmp(t):
    t = t.lower().strip()
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', t)

def clean(t):
    if not t: return ''
    return re.sub(r'\s+', ' ', t).strip()

MATERIA_KW = [
    ('Matematica',          ['matem', 'algebra', 'geometr', 'aritm', 'trigon', 'calculo']),
    ('Fisica',              ['fisica', 'f?sica']),
    ('Quimica',             ['quimica', 'qu?mica']),
    ('Biologia',            ['biolog']),
    ('Lenguaje',            ['lenguaje', 'gram']),
    ('Literatura',          ['literatur']),
    ('Ingles',              ['ingl']),
    ('Historia del Peru',   ['histor', 'per?', 'peru']),
    ('Geografia',           ['geograf']),
    ('Filosofia',           ['filosof']),
    ('Psicologia',          ['psicolog']),
    ('Economia',            ['econom']),
    ('Ciudadania',          ['ciudadan', 'c?vica', 'civica']),
    ('Desarrollo Personal', ['desarrollo personal']),
]
SECCION_MAP = {
    'Matematica':'B','Fisica':'B','Quimica':'B','Biologia':'B',
    'Lenguaje':'A','Literatura':'A','Ingles':'A','Historia del Peru':'A',
    'Geografia':'A','Filosofia':'A','Psicologia':'A','Ciudadania':'A',
    'Desarrollo Personal':'A','Economia':'A',
}
MATERIA_DISPLAY = {
    'Matematica':'Matemática','Fisica':'Física','Quimica':'Química',
    'Biologia':'Biología','Lenguaje':'Lenguaje','Literatura':'Literatura',
    'Ingles':'Inglés','Historia del Peru':'Historia del Perú',
    'Geografia':'Geografía','Filosofia':'Filosofía','Psicologia':'Psicología',
    'Economia':'Economía','Ciudadania':'Ciudadanía',
    'Desarrollo Personal':'Desarrollo Personal',
}

def detect_materia(text, default='General'):
    t = text.lower()
    for mat, kws in MATERIA_KW:
        if any(k in t for k in kws):
            return mat
    return default

def match_resp_to_letter(resp_text, options):
    rn = normalize_cmp(resp_text)
    if not rn or len(rn) < 2:
        return None
    best_let, best_score = None, 0
    for let, opt in options.items():
        on = normalize_cmp(opt)
        if not on: continue
        if rn == on: return let
        score = 0
        if on.startswith(rn) or rn.startswith(on):
            score = min(len(rn), len(on)) * 3
        elif rn in on or on in rn:
            score = min(len(rn), len(on)) * 2
        else:
            rw, ow = set(rn.split()), set(on.split())
            overlap = len(rw & ow)
            if overlap > 0:
                score = overlap * 8
        if score > best_score:
            best_score, best_let = score, let
    return best_let

Q_PAT    = re.compile(r'PREGUNTA\s+N[^0-9]{0,5}(\d+)', re.IGNORECASE)
RESOL_PAT = re.compile(r'RESOLUCI[^A-Za-z]{0,3}N', re.IGNORECASE)
RESP_PAT  = re.compile(r'Respuesta:\s*(.+?)(?:\n|$)', re.DOTALL)
TEMA_PAT  = re.compile(r'Tema:\s*([^\n]+)')

def parse_questions_with_resolutions(col_text, current_materia):
    """Parse una columna que tiene PREGUNTA + opciones + RESOLUCION + Respuesta"""
    results = []
    mat = current_materia
    parts = Q_PAT.split(col_text)
    for i in range(1, len(parts), 2):
        q_num  = int(parts[i])
        block  = parts[i+1] if i+1 < len(parts) else ''
        blk_mat = detect_materia(block[:300], mat)
        mat = blk_mat

        # Split stem from options
        opt_split = re.split(r'\nA\)', block, 1)
        if len(opt_split) < 2:
            opt_split = re.split(r'(?<!\w)A\)', block, 1)
            if len(opt_split) < 2:
                continue

        stem_raw = RESOL_PAT.split(opt_split[0])[0]
        stem_raw = TEMA_PAT.sub('', stem_raw)
        stem = clean(stem_raw)
        if len(stem) < 15:
            continue

        after_a = 'A)' + opt_split[1]
        resol_split = RESOL_PAT.split(after_a, 1)
        opts_text   = resol_split[0]
        resol_text  = resol_split[1] if len(resol_split) > 1 else ''

        options = {}
        for mo in re.finditer(r'([A-E])\)\s*(.*?)(?=[A-E]\)|$)', opts_text, re.DOTALL):
            txt = clean(mo.group(2))
            if txt and len(txt) > 1:
                options[mo.group(1)] = txt[:300]
        if len(options) < 2:
            continue

        tema_m = TEMA_PAT.search(resol_text)
        tema   = clean(tema_m.group(1)) if tema_m else ''
        resp_m = RESP_PAT.search(resol_text)
        resp_txt = clean(resp_m.group(1)) if resp_m else ''

        expl_raw = TEMA_PAT.sub('', resol_text)
        expl_raw = RESP_PAT.sub('', expl_raw)
        expl_raw = Q_PAT.sub('', expl_raw)
        expl = clean(expl_raw)[:600]
        if tema: expl = f'Tema: {tema}. {expl}'

        letra = match_resp_to_letter(resp_txt, options) or 'A'
        opt_d = options.get('D', options.get('E', ''))

        results.append({
            'q_num':     q_num,
            'materia':   mat,
            'stem':      stem[:700],
            'options':   options,
            'opt_d':     opt_d[:250] if opt_d else '',
            'resp_txt':  resp_txt,
            'respuesta': letra,
            'explicacion': expl,
        })
    return results, mat

def parse_questions_only(col_text, current_materia):
    """Parse columna que solo tiene PREGUNTA + opciones (sin RESOLUCION)"""
    results = []
    mat = current_materia
    parts = Q_PAT.split(col_text)
    for i in range(1, len(parts), 2):
        q_num = int(parts[i])
        block = parts[i+1] if i+1 < len(parts) else ''
        blk_mat = detect_materia(block[:300], mat)
        mat = blk_mat

        opt_split = re.split(r'\nA\)', block, 1)
        if len(opt_split) < 2:
            opt_split = re.split(r'(?<!\w)A\)', block, 1)
            if len(opt_split) < 2:
                continue

        stem = clean(RESOL_PAT.split(opt_split[0])[0])
        if len(stem) < 15: continue

        opts_text = 'A)' + opt_split[1]
        opts_text = RESOL_PAT.split(opts_text)[0]
        opts_text = Q_PAT.split(opts_text)[0]

        options = {}
        for mo in re.finditer(r'([A-E])\)\s*(.*?)(?=[A-E]\)|$)', opts_text, re.DOTALL):
            txt = clean(mo.group(2))
            if txt and len(txt) > 1:
                options[mo.group(1)] = txt[:300]
        if len(options) < 2: continue

        opt_d = options.get('D', options.get('E', ''))
        results.append({'q_num': q_num, 'materia': mat, 'stem': stem[:700],
                        'options': options, 'opt_d': opt_d[:250] if opt_d else '',
                        'resp_txt': '', 'respuesta': 'A', 'explicacion': ''})
    return results, mat

STOP_KW = ['banco de estudio', 'preguntas generadas', 'opci?n 2', 'opci?n 3']

all_q_sect1 = {}   # num -> data (with explanations)
all_q_sect2 = {}   # num -> data (without explanations, numbered independently)
answers_sect2 = {} # num -> answer text

with pdfplumber.open('PERU/UNT1.pdf') as pdf:
    total = len(pdf.pages)
    print(f'Total pages: {total}')
    cur_mat = 'General'
    in_stop = False
    in_answers = False
    in_sect2   = False
    seen_pages_sect2 = set()  # to avoid duplicate pages

    for pg_idx in range(2, total):
        page = pdf.pages[pg_idx]
        width = page.width
        full = page.extract_text() or ''
        full_lower = full.lower()

        # ── Detect section ────────────────────────────────────────────────────
        if any(k in full_lower for k in STOP_KW):
            in_stop = True; in_sect2 = False; in_answers = False
            continue

        # Detect UNT 2025-II answer page
        if 'respuestas' in full_lower and ('2025-ii' in full_lower or 'rreessppuueessttaass' in full_lower):
            in_answers = True; in_stop = False; in_sect2 = False
            # Parse answer lines: "1. answer text"
            for mo in re.finditer(r'(\d+)\.\s+(.+?)(?=\n\d+\.|$)', full, re.DOTALL):
                num = int(mo.group(1))
                ans = clean(mo.group(2))[:250]
                if num not in answers_sect2 and ans:
                    answers_sect2[num] = ans
            continue

        if in_answers:
            for mo in re.finditer(r'(\d+)\.\s+(.+?)(?=\n\d+\.|$)', full, re.DOTALL):
                num = int(mo.group(1))
                ans = clean(mo.group(2))[:250]
                if num not in answers_sect2 and ans:
                    answers_sect2[num] = ans
            continue

        # Detect UNT 2025-II exam pages (double-print header)
        if ('eexxa' in full_lower or 'uunntt' in full_lower) and '2025' in full:
            in_sect2 = True; in_stop = False

        # Fingerprint page to avoid duplicates in sect2
        fp = full[:200]
        if in_sect2 and fp in seen_pages_sect2:
            continue
        if in_sect2:
            seen_pages_sect2.add(fp)

        # ── Section 1: pages 3-50 with RESOLUCION ────────────────────────────
        if not in_sect2 and not in_stop:
            for x0, x1 in [(0, width*0.52), (width*0.48, width)]:
                col = page.crop((x0, 0, x1, page.height)).extract_text() or ''
                if not col.strip(): continue
                qs, cur_mat = parse_questions_with_resolutions(col, cur_mat)
                for q in qs:
                    n = q['q_num']
                    if n not in all_q_sect1 or (not all_q_sect1[n]['explicacion'] and q['explicacion']):
                        all_q_sect1[n] = q

        # ── Section 2: UNT 2025-II questions ────────────────────────────────
        elif in_sect2:
            for x0, x1 in [(0, width*0.52), (width*0.48, width)]:
                col = page.crop((x0, 0, x1, page.height)).extract_text() or ''
                if not col.strip(): continue
                qs, cur_mat = parse_questions_only(col, cur_mat)
                for q in qs:
                    n = q['q_num']
                    if n not in all_q_sect2:
                        all_q_sect2[n] = q

print(f'Section 1 (with resolutions): {len(all_q_sect1)} questions')
print(f'Section 2 (exam only):        {len(all_q_sect2)} questions')
print(f'Section 2 answers parsed:     {len(answers_sect2)}')

# Apply text answers to sect2 questions
matched_s2 = 0
for n, q in all_q_sect2.items():
    if n in answers_sect2:
        letra = match_resp_to_letter(answers_sect2[n], q['options'])
        if letra:
            q['respuesta'] = letra
            q['explicacion'] = f'Respuesta correcta: {answers_sect2[n]}'
            matched_s2 += 1

print(f'Section 2 answers matched: {matched_s2}')

# Assemble final list - section 1 first (better quality with explanations)
final = []

for n in sorted(all_q_sect1.keys()):
    q = all_q_sect1[n]
    opts = q['options']
    mat = MATERIA_DISPLAY.get(q['materia'], q['materia'])
    final.append({
        'seccion':    SECCION_MAP.get(q['materia'], 'A'),
        'materia':    mat,
        'enunciado':  q['stem'],
        'opcion_a':   opts.get('A', '')[:250],
        'opcion_b':   opts.get('B', '')[:250],
        'opcion_c':   opts.get('C', '')[:250],
        'opcion_d':   q['opt_d'] or opts.get('D', '')[:250],
        'respuesta':  q['respuesta'],
        'explicacion': q['explicacion'],
    })

for n in sorted(all_q_sect2.keys()):
    q = all_q_sect2[n]
    # Skip if already in sect1 with same content
    opts = q['options']
    mat = MATERIA_DISPLAY.get(q['materia'], q['materia'])
    final.append({
        'seccion':    SECCION_MAP.get(q['materia'], 'A'),
        'materia':    mat,
        'enunciado':  q['stem'],
        'opcion_a':   opts.get('A', '')[:250],
        'opcion_b':   opts.get('B', '')[:250],
        'opcion_c':   opts.get('C', '')[:250],
        'opcion_d':   q['opt_d'] or opts.get('D', '')[:250],
        'respuesta':  q['respuesta'],
        'explicacion': q['explicacion'],
    })

# Remove questions with very short/corrupted stems
final = [q for q in final if len(q['enunciado']) >= 20 and q['opcion_a']]

print(f'\nFinal questions: {len(final)}')
sect_count = {}
mat_count  = {}
for q in final:
    sect_count[q['seccion']] = sect_count.get(q['seccion'], 0) + 1
    mat_count[q['materia']]  = mat_count.get(q['materia'], 0) + 1
print('By section:', sect_count)
print('By materia:', {k:v for k,v in sorted(mat_count.items(), key=lambda x: -x[1])})

print('\nSample:')
for q in final[:3]:
    sys.stdout.buffer.write(f"  [{q['materia']}] resp={q['respuesta']} | {q['enunciado'][:60]}\n".encode('utf-8'))
    sys.stdout.buffer.write(f"    Expl: {q['explicacion'][:80]}\n".encode('utf-8'))

with open('PERU/preguntas_unt.json', 'w', encoding='utf-8') as f:
    json.dump(final, f, ensure_ascii=False, indent=2)
print(f'\nSaved PERU/preguntas_unt.json ({len(final)} questions)')
