# -*- coding: utf-8 -*-
"""
Extrae Q1-Q100 de UNT1.pdf (Solucionario Admisión UNT 2025-II)
Orden de lectura: columna izquierda → columna derecha, página a página.
Nos guiamos por PREGUNTA N.º X para delimitar cada bloque.
"""
import sys, io, re, json
import pdfplumber

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PDF_PATH   = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\UNT1.pdf'
OUTPUT     = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\preguntas_unt1_v3.json'
PAGE_START = 317   # 0-indexed
PAGE_END   = 362   # 0-indexed exclusive
COLUMN_MID = 234.0

SECCIONES = [
    (r'desarrollo personal|ciudadan|cívic', 'Desarrollo Personal'),
    (r'psicolog', 'Psicología'),
    (r'biolog', 'Biología'),
    (r'econom', 'Economía'),
    (r'filosof', 'Filosofía'),
    (r'histor', 'Historia'),
    (r'lenguaje|comunicac', 'Lenguaje'),
    (r'literatur', 'Literatura'),
    (r'matemát|matem', 'Matemática'),
    (r'física', 'Física'),
    (r'química', 'Química'),
    (r'inglés|ingles|english|reading\s+comprehension', 'Inglés'),
    (r'geografía|geograf', 'Geografía'),
]

def detect_materia(text: str, current: str) -> str:
    t = text.lower()
    for pat, name in SECCIONES:
        if re.search(pat, t):
            return name
    return current

def clean(s: str) -> str:
    s = re.sub(r'[^\x09\x0a\x0d\x20-\xff]', '', s)
    s = re.sub(r'[ \t]{2,}', ' ', s)
    return s.strip()

def words_to_text(ws):
    """Convierte lista de palabras ordenadas en texto línea a línea."""
    if not ws:
        return ''
    ws = sorted(ws, key=lambda w: (round(w['top'] / 4) * 4, w['x0']))
    lines, cur_top, cur_line = [], ws[0]['top'], []
    for w in ws:
        if abs(w['top'] - cur_top) > 5:
            lines.append(' '.join(cur_line))
            cur_line = [w['text']]
            cur_top = w['top']
        else:
            cur_line.append(w['text'])
    if cur_line:
        lines.append(' '.join(cur_line))
    return '\n'.join(lines)

def parse_options(text: str) -> dict:
    opts = {}
    # Formato multilinea: cada línea empieza con A) B) C)...
    for m in re.finditer(r'(?:^|\n)\s*([A-E])\)\s*(.+?)(?=(?:\n\s*[A-E]\))|\Z)', text, re.DOTALL):
        lbl, val = m.group(1), clean(m.group(2).replace('\n', ' '))
        if val and len(val) < 300:
            opts[lbl] = val
    # Formato inline: "A) x B) y C) z"
    if len(opts) < 2:
        for m in re.finditer(r'\b([A-E])\)\s*(.+?)(?=\s+[A-E]\)|\Z)', text):
            lbl, val = m.group(1), clean(m.group(2))
            if val:
                opts[lbl] = val
    return opts

def find_answer(resol: str, opts: dict) -> str:
    # 1) "Respuesta: D" o "Rpta.: D"
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*([A-E])\b', resol, re.IGNORECASE)
    if m:
        return m.group(1)
    # 2) "Respuesta: texto" → comparar con opciones
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*(.{1,150}?)(?:\n|$)', resol, re.IGNORECASE)
    if m:
        ans = clean(m.group(1))
        an  = re.sub(r'[^a-z0-9]', '', ans.lower())
        for lbl, opt in opts.items():
            on = re.sub(r'[^a-z0-9]', '', opt.lower())
            if an and (an in on or on.startswith(an[:15])):
                return lbl
        nums_a = re.findall(r'\d+', ans)
        for lbl, opt in opts.items():
            if nums_a and nums_a == re.findall(r'\d+', opt):
                return lbl
    # 3) Letra suelta en el final
    tail = resol[-300:]
    m2 = re.search(r'\b([A-E])\s*$', tail.strip())
    if m2 and m2.group(1) in opts:
        return m2.group(1)
    return list(opts.keys())[0] if opts else 'A'

def parse_block(block: str):
    """Parsea un bloque de texto de UNA pregunta."""
    # Quitar la marca PREGUNTA N.º X del inicio
    block = re.sub(r'^PREGUNTA\s+N[.º°ﾟ]+\s*\d+\s*', '', block, flags=re.IGNORECASE).strip()

    resol_m = re.search(r'RESOLUCI[OÓ]N', block, re.IGNORECASE)
    if resol_m:
        q_part = block[:resol_m.start()].strip()
        r_part = block[resol_m.end():].strip()
    else:
        q_part = block.strip()
        r_part = ''

    # Enunciado
    first_opt = re.search(r'(?:^|\n)\s*[A-E]\)', q_part)
    if first_opt:
        stem = clean(q_part[:first_opt.start()].replace('\n', ' '))
        opts = parse_options(q_part[first_opt.start():])
    else:
        stem = clean(q_part.replace('\n', ' '))
        opts = {}

    # Limpiar artefactos de doble carácter del PDF
    stem = re.sub(r'(.)\1', lambda m: m.group(1), stem)
    stem = clean(stem)

    # Tema
    tema_m = re.search(r'Tema\s*[:\-]\s*(.+?)(?:\n|$)', r_part, re.IGNORECASE)
    tema = clean(tema_m.group(1)) if tema_m else ''

    answer = find_answer(r_part, opts)

    # Resolución limpia (sin línea de respuesta)
    resol_clean = re.sub(r'Respuesta\s*[:\-].*', '', r_part, flags=re.IGNORECASE).strip()
    resol_clean = clean(resol_clean)

    return stem, opts, answer, tema, resol_clean

def main():
    print(f'Abriendo {PDF_PATH} ...')
    with pdfplumber.open(PDF_PATH) as pdf:
        total = len(pdf.pages)
        print(f'Total páginas: {total}')

        # ── Construir stream único: LEFT p317, RIGHT p317, LEFT p318, RIGHT p318... ──
        segments = []          # (page_idx, col, text)
        current_materia = 'General'

        for pi in range(PAGE_START, min(PAGE_END, total)):
            page = pdf.pages[pi]
            words = page.extract_words(x_tolerance=3, y_tolerance=3) or []
            lw = [w for w in words if w['x0'] <  COLUMN_MID]
            rw = [w for w in words if w['x0'] >= COLUMN_MID]
            lt = words_to_text(lw)
            rt = words_to_text(rw)
            segments.append((pi, 'L', lt))
            segments.append((pi, 'R', rt))

        # ── Unir en un gran stream de texto con marcadores ───────────────────
        full = '\n'.join(t for _, _, t in segments)

        # ── Detectar materia por sección (buscar encabezados en el stream) ───
        # Construir lista de (posición, materia)
        materia_marks = [(0, 'General')]
        for pat, name in SECCIONES:
            for m in re.finditer(pat, full, re.IGNORECASE):
                materia_marks.append((m.start(), name))
        materia_marks.sort()

        def get_materia_at(pos):
            mat = 'General'
            for mp, mn in materia_marks:
                if mp <= pos:
                    mat = mn
                else:
                    break
            return mat

        # ── Dividir por PREGUNTA N.º X ────────────────────────────────────────
        Q_PAT = r'PREGUNTA\s+N[.º°ﾟ]+\s*(\d+)'
        q_marks = list(re.finditer(Q_PAT, full, re.IGNORECASE))
        print(f'Marcadores de pregunta encontrados: {len(q_marks)}')

        raw_blocks = {}   # num -> (block_text, materia)
        for idx, qm in enumerate(q_marks):
            num = int(qm.group(1))
            start = qm.start()
            end   = q_marks[idx+1].start() if idx+1 < len(q_marks) else len(full)
            block = full[start:end]
            mat   = get_materia_at(start)
            # Si ya existe, queda el bloque más largo (más completo)
            if num not in raw_blocks or len(block) > len(raw_blocks[num][0]):
                raw_blocks[num] = (block, mat)

        print(f'Preguntas únicas: {len(raw_blocks)}')

        questions = []
        skipped   = []
        for num in sorted(raw_blocks.keys()):
            if num > 100:
                continue   # ignorar números espurios
            block, mat = raw_blocks[num]
            stem, opts, answer, tema, resol = parse_block(block)

            if not stem or len(stem) < 10:
                skipped.append(num); continue
            if len(opts) < 2:
                # Intento fallback: buscar opciones en la resolución
                opts2 = parse_options(resol)
                if len(opts2) >= 2:
                    opts = opts2
                else:
                    skipped.append(num); continue

            q = {
                'numero_pregunta': num,
                'seccion': 'A',
                'materia': mat,
                'enunciado': stem,
                'opcion_a': opts.get('A', ''),
                'opcion_b': opts.get('B', ''),
                'opcion_c': opts.get('C', ''),
                'opcion_d': opts.get('D', ''),
                'opcion_e': opts.get('E', ''),
                'respuesta': answer,
                'explicacion': resol,
                'tema': tema,
            }
            questions.append(q)
            print(f'  Q{num:3d} [{mat:20s}] ans={answer}  "{stem[:55]}"')

        if skipped:
            print(f'\nSALTADAS: {skipped}')

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    print(f'\nGuardado: {OUTPUT}  ({len(questions)} preguntas)')

if __name__ == '__main__':
    main()
