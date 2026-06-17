# -*- coding: utf-8 -*-
"""
Extrae los 9 exámenes completos de UNT1.pdf (~900 preguntas con resoluciones).
Cada examen empieza donde aparece Q1: páginas 3,77,101,125,150,175,216,267,318
"""
import sys, io, re, json
import pdfplumber

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PDF_PATH   = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\UNT1.pdf'
OUTPUT     = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\preguntas_todos_examenes.json'
COLUMN_MID = 234.0

# Rangos 0-indexed (inicio de cada examen)
EXAM_RANGES = [
    (1,  2,   76),   # Examen 1: páginas 3-76
    (2,  76,  100),  # Examen 2: páginas 77-100
    (3,  100, 124),  # Examen 3: páginas 101-124
    (4,  124, 149),  # Examen 4: páginas 125-149
    (5,  149, 174),  # Examen 5: páginas 150-174
    (6,  174, 215),  # Examen 6: páginas 175-215
    (7,  215, 266),  # Examen 7: páginas 216-266
    (8,  266, 317),  # Examen 8: páginas 267-317
    (9,  317, 366),  # Examen 9: páginas 318-366 (UNT 2025-II)
]

TEMA_MATERIA = [
    (r'procesos afectivos|amor|sexualidad|identidad|percepción|inteligencia|hominización|enamoramiento|psicoanál|androgin', 'Psicología'),
    (r'servicio militar|organismos constitucionales|atribuciones.*consejo|atribuciones.*premier|defensa civil|defensa nacional|discriminación|proyecto de vida|violencia|ciudadan|constitución|derechos|estado|gobierno|migración|normas jurídicas', 'Desarrollo Personal'),
    (r'tectónica|placa|clima|bioma|amazón|ciudad.*peruana|geografía|relieve|hidrografía', 'Geografía'),
    (r'revolución|guerra|virreinato|inca|independencia|historia del perú|siglo xx|siglo xix|período', 'Historia'),
    (r'pbi|inflación|oferta|demanda|moneda|dinero\b|indicadores económicos|subdesarrollo|mercado|empresa|producción', 'Economía'),
    (r'jerarquía textual|sentido contextual|inferencia textual|mecanismos de cohesión|pronombre|usos de la comilla|la coma|el adjetivo|el verbo|tildación|ortografía|sintaxis|semántica|lenguaje|lectura|comprensión lectora|comunicación|figuras literarias|registro lingüístico|conectores', 'Lenguaje'),
    (r'literatura|género literario|realismo|narrativa|poesía|dramática|boom|novela|cuento|romanticismo|vanguardia', 'Literatura'),
    (r'there is|there are|reading comprehension|inglés|english|grammar|vocabulary|verb tense|present.*simple|past.*simple|future|modal', 'Inglés'),
    (r'permutación|combinación|tanto por ciento|álgebra|geometría|trigonometr|cálculo|estadíst|probabilid|aritmét|cónica|sucesión|función|logaritm|polinomio|ecuaciones|progresión|proporcionalidad|operacion|regla de tres|interés\b|razón|fracción|números|conjuntos|teorema', 'Matemática'),
    (r'cinemática|fuerza|newton|energía|trabajo mecánico|óptica|electromagnetismo|termodinámica|dinámica|movimiento|velocidad|aceleración|presión|calor|temperatura|ondas', 'Física'),
    (r'nomenclatura|enlace|reacción|tabla periódica|funciones nitrogenadas|química|mol\b|estequio|ácido|base\b|solución|oxidación', 'Química'),
    (r'biología|célula|ecología|genética|biología celular|organelo|fotosíntes|respiración celular|ecosistema|evolución|herencia|sistema endocrino|hormona|lisosoma|cloroplasto|adn|rna|mitosis|meiosis', 'Biología'),
]

def materia_from_tema(tema: str, enunciado: str) -> str:
    txt = (tema + ' ' + enunciado).lower()
    for pat, name in TEMA_MATERIA:
        if re.search(pat, txt):
            return name
    return 'General'

def clean(s: str) -> str:
    s = re.sub(r'[^\x09\x0a\x0d\x20-\xff]', '', s)
    s = re.sub(r'[ \t]{2,}', ' ', s)
    return s.strip()

def words_to_text(ws):
    if not ws: return ''
    ws = sorted(ws, key=lambda w: (round(w['top']/4)*4, w['x0']))
    lines, cur_top, cur_line = [], ws[0]['top'], []
    for w in ws:
        if abs(w['top'] - cur_top) > 5:
            lines.append(' '.join(cur_line)); cur_line = [w['text']]; cur_top = w['top']
        else:
            cur_line.append(w['text'])
    if cur_line: lines.append(' '.join(cur_line))
    return '\n'.join(lines)

def remove_pdf_doubles(text):
    def fix_word(w):
        chars = list(w)
        if len(chars) >= 4 and len(chars) % 2 == 0:
            pairs = [(chars[i], chars[i+1]) for i in range(0, len(chars), 2)]
            if all(a == b for a, b in pairs):
                return ''.join(a for a, _ in pairs)
        return w
    return ' '.join(fix_word(w) for w in text.split())

def parse_options(text):
    opts = {}
    ml = re.compile(r'(?:^|\n)\s*([A-E])\)\s*(.+?)(?=\n\s*[A-E]\)|\Z)', re.DOTALL)
    for m in ml.finditer(text):
        lbl, val = m.group(1), clean(m.group(2).replace('\n', ' '))
        if val and len(val) < 400: opts[lbl] = val
    if len(opts) >= 3: return opts
    opts2 = {}
    for m in re.finditer(r'\b([A-E])\)\s*(.+?)(?=\s+[A-E]\)|\Z)', text):
        lbl, val = m.group(1), clean(m.group(2))
        if val: opts2[lbl] = val
    return opts2 if len(opts2) > len(opts) else opts

def find_answer(resol, opts):
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*([A-E])\b', resol, re.IGNORECASE)
    if m: return m.group(1)
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*(.{1,150}?)(?:\n|$)', resol, re.IGNORECASE)
    if m:
        ans = clean(m.group(1))
        an = re.sub(r'[^a-z0-9áéíóúüñ]', '', ans.lower())
        best, best_len = '', 0
        for lbl, opt in opts.items():
            on = re.sub(r'[^a-z0-9áéíóúüñ]', '', opt.lower())
            if an and on.startswith(an[:min(len(an),15)]):
                if len(an) > best_len: best, best_len = lbl, len(an)
        if best: return best
        nums_a = re.findall(r'\d+', ans)
        for lbl, opt in opts.items():
            if nums_a and nums_a == re.findall(r'\d+', opt): return lbl
    tail = resol[-400:]
    m2 = re.search(r'\b([A-E])\s*(?:\n|$)', tail.strip())
    if m2 and m2.group(1) in opts: return m2.group(1)
    return list(opts.keys())[0] if opts else 'A'

def parse_block(block):
    block = re.sub(r'^PREGUNTA\s+N[.º°ﾟ]+\s*\d+\s*', '', block, flags=re.IGNORECASE).strip()
    lines = [remove_pdf_doubles(l) for l in block.split('\n')]
    block = '\n'.join(lines)

    resol_m = re.search(r'RESOLUCI[OÓ]N', block, re.IGNORECASE)
    if resol_m:
        q_part = block[:resol_m.start()].strip()
        r_part = block[resol_m.end():].strip()
    else:
        q_part = block.strip(); r_part = ''

    first_opt_m = re.search(r'(?:^|\n)\s*[A-E]\)', q_part)
    if first_opt_m:
        stem = clean(q_part[:first_opt_m.start()].replace('\n', ' '))
        opts = parse_options(q_part[first_opt_m.start():])
    else:
        inline_m = re.search(r'\s+[A-E]\)\s', q_part)
        if inline_m:
            stem = clean(q_part[:inline_m.start()])
            opts = parse_options(q_part[inline_m.start():])
        else:
            stem = clean(q_part.replace('\n', ' ')); opts = {}

    stem = clean(stem)
    tema_m = re.search(r'Tema\s*[:\-]\s*(.+?)(?:\n|$)', r_part, re.IGNORECASE)
    tema = clean(tema_m.group(1)) if tema_m else ''
    answer = find_answer(r_part, opts)
    resol_clean = re.sub(r'(?:Respuesta|Rpta\.?)\s*[:\-].*', '', r_part, flags=re.IGNORECASE).strip()
    return stem, opts, answer, tema, clean(resol_clean)

def extract_exam(pdf, page_start, page_end, exam_num):
    """Extrae un examen completo de las páginas dadas."""
    full_parts = []
    for pi in range(page_start, min(page_end, len(pdf.pages))):
        page = pdf.pages[pi]
        words = page.extract_words(x_tolerance=3, y_tolerance=3) or []
        lw = [w for w in words if w['x0'] <  COLUMN_MID]
        rw = [w for w in words if w['x0'] >= COLUMN_MID]
        full_parts.append(words_to_text(lw))
        full_parts.append(words_to_text(rw))

    full = '\n'.join(full_parts)
    Q_PAT = r'PREGUNTA\s+N[.º°ﾟ]+\s*(\d+)'
    q_marks = list(re.finditer(Q_PAT, full, re.IGNORECASE))

    raw_blocks = {}
    for idx, qm in enumerate(q_marks):
        num = int(qm.group(1))
        if num > 100: continue
        start = qm.start()
        end = q_marks[idx+1].start() if idx+1 < len(q_marks) else len(full)
        block = full[start:end]
        if num not in raw_blocks or len(block) > len(raw_blocks[num]):
            raw_blocks[num] = block

    questions = []
    for num in sorted(raw_blocks.keys()):
        block = raw_blocks[num]
        stem, opts, answer, tema, resol = parse_block(block)
        if not stem or len(stem) < 8: continue
        if len(opts) < 2:
            opts = parse_options(block)
            if len(opts) < 2: continue
        mat = materia_from_tema(tema, stem)
        questions.append({
            'examen': exam_num,
            'numero_pregunta': num,
            'seccion': 'A',
            'materia': mat,
            'enunciado': stem,
            'opcion_a': opts.get('A',''),
            'opcion_b': opts.get('B',''),
            'opcion_c': opts.get('C',''),
            'opcion_d': opts.get('D',''),
            'respuesta': answer,
            'explicacion': resol,
            'tema': tema,
        })
    return questions

def main():
    all_questions = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for exam_num, page_start, page_end in EXAM_RANGES:
            print(f'Examen {exam_num} (páginas {page_start+1}-{page_end})...', end=' ', flush=True)
            qs = extract_exam(pdf, page_start, page_end, exam_num)
            print(f'{len(qs)} preguntas')
            all_questions.extend(qs)

    print(f'\nTotal: {len(all_questions)} preguntas')

    # Resumen por materia
    from collections import Counter
    cnt = Counter(q['materia'] for q in all_questions)
    for mat, n in cnt.most_common():
        print(f'  {mat:25s} {n}')

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
    print(f'\nGuardado: {OUTPUT}')

if __name__ == '__main__':
    main()
