# -*- coding: utf-8 -*-
"""
Extrae TODAS las preguntas del Solucionario UNT 2025-II (UNT1.pdf)
Páginas 318-362 (índice 317-361). Formato 2 columnas:
  Izquierda (x < mid): enunciado + opciones
  Derecha   (x >= mid): RESOLUCIÓN + Respuesta

Salida: PERU/preguntas_unt1_completo.json
"""
import sys, io, re, json
import pdfplumber

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PDF_PATH   = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\UNT1.pdf'
OUTPUT     = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\preguntas_unt1_completo.json'
PAGE_START = 317   # 0-indexed
PAGE_END   = 362   # 0-indexed exclusive

# ── Materias detectadas por sección ──────────────────────────────────────────
MATERIA_HEADERS = {
    r'desarrollo personal|ciudadan|cívic': 'Desarrollo Personal',
    r'psicolog': 'Psicología',
    r'biolog': 'Biología',
    r'econom': 'Economía',
    r'filosofía|filosof': 'Filosofía',
    r'histor': 'Historia',
    r'lenguaje|comunicac': 'Lenguaje',
    r'literatur': 'Literatura',
    r'matemát|matem': 'Matemática',
    r'física': 'Física',
    r'química': 'Química',
    r'inglés|ingles|english': 'Inglés',
    r'geografía|geograf': 'Geografía',
    r'educación cívica|educ.*cívic': 'Educación Cívica',
}

def detect_materia(text: str, current: str) -> str:
    t = text.lower()
    for pattern, name in MATERIA_HEADERS.items():
        if re.search(pattern, t):
            return name
    return current

def clean(s: str) -> str:
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)
    s = re.sub(r'\s{2,}', ' ', s).strip()
    return s

def extract_page_columns(page):
    """Extrae words y los divide en columna izq / der por posición x."""
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    if not words:
        return '', ''
    mid = page.width / 2.0
    left_words  = sorted([w for w in words if w['x0'] < mid],  key=lambda w: (round(w['top']/5)*5, w['x0']))
    right_words = sorted([w for w in words if w['x0'] >= mid], key=lambda w: (round(w['top']/5)*5, w['x0']))

    def words_to_text(ws):
        if not ws: return ''
        lines, cur_y, cur_line = [], ws[0]['top'], []
        for w in ws:
            if abs(w['top'] - cur_y) > 6:
                lines.append(' '.join(cur_line))
                cur_line = [w['text']]
                cur_y = w['top']
            else:
                cur_line.append(w['text'])
        if cur_line:
            lines.append(' '.join(cur_line))
        return '\n'.join(lines)

    return words_to_text(left_words), words_to_text(right_words)

def parse_options(text: str):
    """Extrae opciones A-E del texto."""
    opts = {}
    # Patrón: A) ... B) ... o A) ... \n B)...
    for m in re.finditer(r'\b([A-E])\)\s*(.+?)(?=\s+[A-E]\)|\Z)', text, re.DOTALL):
        lbl = m.group(1)
        val = clean(m.group(2).replace('\n', ' '))
        # Cortar si hay otro patrón de pregunta después
        val = re.sub(r'\s*PREGUNTA.*', '', val, flags=re.IGNORECASE).strip()
        if val and len(val) < 300:
            opts[lbl] = val
    return opts

def parse_answer(resol_text: str, options: dict) -> str:
    """Extrae la letra de respuesta del bloque RESOLUCIÓN."""
    # 1) Busca "Respuesta: C" o "Rpta.: C"
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*([A-E])\b', resol_text)
    if m:
        return m.group(1)

    # 2) Busca la letra A-E sola cerca del final
    tail = resol_text[-400:]
    m = re.search(r'\b([A-E])\)\s*[\w,.]', tail)
    if m and m.group(1) in options:
        return m.group(1)

    # 3) Busca "Respuesta: <texto>" y lo mapea a una opción
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*(.{1,120})', resol_text)
    if m:
        ans_text = clean(m.group(1).split('\n')[0])
        # comparar con opciones
        for lbl, opt in options.items():
            a_norm = re.sub(r'[^a-z0-9]', '', ans_text.lower())
            o_norm = re.sub(r'[^a-z0-9]', '', opt.lower())
            if a_norm and (a_norm in o_norm or o_norm in a_norm):
                return lbl
        # Si tiene valor numérico
        nums_ans = re.findall(r'\d+', ans_text)
        for lbl, opt in options.items():
            nums_opt = re.findall(r'\d+', opt)
            if nums_ans and nums_ans == nums_opt:
                return lbl

    return list(options.keys())[0] if options else 'A'

def extract_tema(resol_text: str) -> str:
    m = re.search(r'Tema\s*[:\-]\s*(.+?)(?:\n|$)', resol_text, re.IGNORECASE)
    return clean(m.group(1)) if m else ''

# ── Extracción principal ──────────────────────────────────────────────────────
def main():
    print(f'Abriendo {PDF_PATH}...')
    with pdfplumber.open(PDF_PATH) as pdf:
        total = len(pdf.pages)
        print(f'Total páginas: {total}')

        # Acumular todo el texto de izquierda y derecha por página
        current_materia = 'General'
        # Diccionario num -> {left_chunks, right_chunks, materia, page}
        q_data = {}   # num -> {'left': str, 'right': str, 'materia': str}

        for pi in range(PAGE_START, min(PAGE_END, total)):
            page = pdf.pages[pi]
            left, right = extract_page_columns(page)

            # Detectar cambio de materia por encabezados de sección
            full_text = left + ' ' + right
            current_materia = detect_materia(full_text, current_materia)

            # Dividir left por bloques de preguntas
            # Marcador: "PREGUNTA N.º 77" o "PREGUNTA N.° 77"
            q_split = re.split(r'(PREGUNTA\s+N[.º°ﾟ�]+\s*\d+)', left)
            # Igualmente el right
            r_split = re.split(r'(PREGUNTA\s+N[.º°ﾟ�]+\s*\d+)', right)

            def collect_blocks(parts):
                """Convierte lista de split en dict num->text."""
                blocks = {}
                i = 0
                while i < len(parts):
                    chunk = parts[i]
                    num_m = re.search(r'(\d+)\s*$', chunk)
                    if num_m and i+1 < len(parts):
                        num = int(num_m.group(1))
                        blocks[num] = parts[i+1] if i+1 < len(parts) else ''
                        i += 2
                    else:
                        i += 1
                return blocks

            left_blocks  = collect_blocks(q_split)
            right_blocks = collect_blocks(r_split)

            all_nums = set(left_blocks) | set(right_blocks)
            for num in all_nums:
                if num not in q_data:
                    q_data[num] = {'left': '', 'right': '', 'materia': current_materia, 'page': pi+1}
                q_data[num]['left']  += '\n' + left_blocks.get(num, '')
                q_data[num]['right'] += '\n' + right_blocks.get(num, '')
                if left_blocks.get(num, '') or right_blocks.get(num, ''):
                    q_data[num]['materia'] = current_materia

        print(f'Preguntas encontradas: {len(q_data)}')

        # ── Construir JSON final ──────────────────────────────────────────────
        questions = []
        for num in sorted(q_data.keys()):
            d = q_data[num]
            left_text  = clean(d['left'])
            right_text = clean(d['right'])

            # Enunciado: todo en left antes de "A)"
            stem_end = len(left_text)
            first_opt = re.search(r'\b[A-E]\)', left_text)
            if first_opt:
                stem_end = first_opt.start()
            stem = clean(left_text[:stem_end])
            # Quitar número de pregunta del inicio si quedó
            stem = re.sub(r'^PREGUNTA\s+N[.º°�]+\s*\d+\s*', '', stem, flags=re.IGNORECASE).strip()

            # Opciones
            opts = parse_options(left_text)
            if len(opts) < 2:
                opts = parse_options(left_text + '\n' + right_text)

            # Resolución: todo el right (o parte del left después de las opciones)
            resol = right_text
            if 'RESOLUCIÓN' not in resol and 'Tema:' not in resol:
                # Puede estar al final del left
                resol_m = re.search(r'RESOLUC', left_text, re.IGNORECASE)
                if resol_m:
                    resol = left_text[resol_m.start():]

            answer = parse_answer(resol, opts)
            tema   = extract_tema(resol)

            # Limpiar resolución de encabezados repetidos
            resol_clean = re.sub(r'^RESOLUC[IÓ]N\s*', '', resol, flags=re.IGNORECASE).strip()
            resol_clean = re.sub(r'Respuesta\s*[:\-]\s*[A-E]\b', '', resol_clean).strip()

            if not stem or len(stem) < 8:
                print(f'  [SKIP] Q{num}: stem muy corto "{stem[:50]}"')
                continue

            q = {
                'numero_pregunta': num,
                'seccion': 'A',
                'materia': d['materia'],
                'enunciado': stem,
                'opcion_a': opts.get('A', ''),
                'opcion_b': opts.get('B', ''),
                'opcion_c': opts.get('C', ''),
                'opcion_d': opts.get('D', ''),
                'opcion_e': opts.get('E', ''),
                'respuesta': answer,
                'explicacion': resol_clean,
                'tema': tema,
                'pagina_pdf': d['page'],
            }
            questions.append(q)
            print(f'  Q{num} [{d["materia"]}] ans={answer} stem={stem[:60]}...')

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    print(f'\nGuardado: {OUTPUT}  ({len(questions)} preguntas)')

if __name__ == '__main__':
    main()
