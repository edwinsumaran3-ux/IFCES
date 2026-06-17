# -*- coding: utf-8 -*-
"""
Extrae Q1-Q100 de UNT1.pdf (Solucionario Admisión UNT 2025-II)
Páginas 318-362 (índice 317-361).
CADA columna contiene UNA pregunta COMPLETA + su RESOLUCIÓN.
"""
import sys, io, re, json
import pdfplumber

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PDF_PATH   = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\UNT1.pdf'
OUTPUT     = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\preguntas_unt1_v2.json'
PAGE_START = 317   # 0-indexed (= página 318 del archivo)
PAGE_END   = 362   # 0-indexed exclusive

COLUMN_MID = 234.0   # x < 234 → columna izquierda; x >= 234 → columna derecha

# ── Sección/Materia por encabezado ────────────────────────────────────────────
SECCIONES = [
    (r'desarrollo personal|ciudadan|cívic', 'Desarrollo Personal'),
    (r'psicolog', 'Psicología'),
    (r'biolog', 'Biología'),
    (r'econom', 'Economía'),
    (r'filosofía|filosof', 'Filosofía'),
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
    s = re.sub(r'[^\x09\x0a\x0d\x20-\x7e\x80-\xff]', '', s)
    s = re.sub(r'[ \t]{2,}', ' ', s)
    return s.strip()

def words_to_lines(ws):
    """Agrupa palabras por proximidad vertical en líneas."""
    if not ws:
        return []
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
    return lines

def parse_question_block(block_text: str):
    """
    Dado el texto de UNA pregunta (con resolución), extrae:
    stem, opciones, resolución, respuesta.
    """
    # Separar en dos partes: antes y después de RESOLUCIÓN
    resol_m = re.search(r'RESOLUCI[OÓ]N', block_text, re.IGNORECASE)
    if resol_m:
        pregunta_part = block_text[:resol_m.start()]
        resol_part    = block_text[resol_m.end():].strip()
    else:
        pregunta_part = block_text
        resol_part    = ''

    # ── Enunciado: antes de la primera opción ────────────────────────────────
    first_opt_m = re.search(r'\n\s*[A-E]\)', pregunta_part)
    if first_opt_m:
        stem_raw = pregunta_part[:first_opt_m.start()].strip()
        opts_raw = pregunta_part[first_opt_m.start():]
    else:
        stem_raw = pregunta_part.strip()
        opts_raw = ''

    stem = clean(re.sub(r'\n', ' ', stem_raw))
    # Quitar número de pregunta del inicio si quedó
    stem = re.sub(r'^PREGUNTA\s+N[.º°ﾟ]+\s*\d+\s*', '', stem, flags=re.IGNORECASE).strip()
    # Quitar encabezado de materia del inicio
    for pat, _ in SECCIONES:
        stem = re.sub(r'^(' + pat + r')[^\n]*\n?', '', stem, flags=re.IGNORECASE).strip()
    # Doble carácter (artefacto PDF): SSoolluucciioonnaarriioo → Solucionario
    stem = re.sub(r'(.)\1{1}', lambda m: m.group(1), stem)
    stem = clean(stem)

    # ── Opciones ─────────────────────────────────────────────────────────────
    opts: dict[str, str] = {}
    # Dos formatos: "A) texto" en líneas separadas, o "A) t1 B) t2 C) t3" inline
    for m in re.finditer(r'(?:^|\n)\s*([A-E])\)\s*(.+?)(?=\n\s*[A-E]\)|$)', opts_raw, re.DOTALL):
        lbl = m.group(1)
        val = clean(m.group(2).replace('\n', ' '))
        if val:
            opts[lbl] = val
    # Formato inline: A) x B) y C) z (en una sola línea)
    if len(opts) < 2:
        for m in re.finditer(r'\b([A-E])\)\s*(.+?)(?=\s+[A-E]\)|\s*$)', opts_raw):
            opts[m.group(1)] = clean(m.group(2))

    # ── Respuesta ─────────────────────────────────────────────────────────────
    answer = ''
    # 1) "Respuesta: Storge" o "Respuesta: D"
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*(.+?)(?:\n|$)', resol_part, re.IGNORECASE)
    if m:
        ans_text = clean(m.group(1))
        # ¿Es letra?
        if re.match(r'^[A-E]$', ans_text):
            answer = ans_text
        else:
            # Buscar qué opción coincide
            ans_norm = re.sub(r'[^a-z0-9]', '', ans_text.lower())
            best, best_score = '', 0
            for lbl, opt in opts.items():
                opt_norm = re.sub(r'[^a-z0-9]', '', opt.lower())
                # Buscar si el texto de respuesta está contenido en la opción
                if ans_norm and (ans_norm in opt_norm or opt_norm.startswith(ans_norm[:12])):
                    score = len(ans_norm)
                    if score > best_score:
                        best, best_score = lbl, score
                # Match por números
                nums_a = re.findall(r'\d+', ans_text)
                nums_o = re.findall(r'\d+', opt)
                if nums_a and nums_a == nums_o:
                    best = lbl
            answer = best

    if not answer and opts:
        # 2) Letra suelta al final de la resolución
        tail = resol_part[-300:]
        m2 = re.search(r'\b([A-E])\b(?:\s*$|\s*\n)', tail)
        if m2 and m2.group(1) in opts:
            answer = m2.group(1)

    if not answer:
        answer = list(opts.keys())[0] if opts else 'A'

    # ── Tema ─────────────────────────────────────────────────────────────────
    tema_m = re.search(r'Tema\s*[:\-]\s*(.+?)(?:\n|$)', resol_part, re.IGNORECASE)
    tema = clean(tema_m.group(1)) if tema_m else ''

    # ── Limpiar resolución ────────────────────────────────────────────────────
    resol_clean = re.sub(r'Respuesta\s*[:\-]\s*[A-E]?\b.*', '', resol_part, flags=re.IGNORECASE).strip()
    resol_clean = clean(resol_clean)

    return {
        'stem': stem,
        'opts': opts,
        'answer': answer,
        'tema': tema,
        'resol': resol_clean,
    }

# ── Extracción principal ──────────────────────────────────────────────────────
def main():
    print(f'Abriendo {PDF_PATH} ...')
    with pdfplumber.open(PDF_PATH) as pdf:
        total = len(pdf.pages)
        print(f'Total páginas: {total} | extrayendo {PAGE_END - PAGE_START} páginas')

        # Construir dos streams de texto: left_stream y right_stream
        current_materia_left  = 'General'
        current_materia_right = 'General'
        # List of (question_num, column_text, materia)
        raw_questions = []

        for pi in range(PAGE_START, min(PAGE_END, total)):
            page = pdf.pages[pi]
            words = page.extract_words(x_tolerance=3, y_tolerance=3) or []

            left_words  = [w for w in words if w['x0'] < COLUMN_MID]
            right_words = [w for w in words if w['x0'] >= COLUMN_MID]

            left_lines  = words_to_lines(left_words)
            right_lines = words_to_lines(right_words)

            left_text  = '\n'.join(left_lines)
            right_text = '\n'.join(right_lines)

            # Detectar cambio de materia
            for col_text in [left_text, right_text]:
                current_materia_left = detect_materia(col_text, current_materia_left)

            # Dividir cada columna en bloques por PREGUNTA N.º X
            Q_PATTERN = r'(?:PREGUNTA\s+N[.º°ﾟ]+\s*)(\d+)'

            for col_text, col_name in [(left_text, 'L'), (right_text, 'R')]:
                # Encuentra todos los números de pregunta en esta columna
                q_marks = list(re.finditer(Q_PATTERN, col_text, re.IGNORECASE))
                for idx, qm in enumerate(q_marks):
                    num = int(qm.group(1))
                    # Texto del bloque: desde el número hasta el siguiente o fin
                    start = qm.start()
                    end   = q_marks[idx+1].start() if idx+1 < len(q_marks) else len(col_text)
                    block = col_text[start:end]
                    raw_questions.append((num, block, current_materia_left, pi+1, col_name))

        print(f'Bloques encontrados: {len(raw_questions)}')

        # Deduplicar: si hay duplicados del mismo número, preferir el que tiene más contenido
        best: dict[int, tuple] = {}
        for num, block, mat, page, col in raw_questions:
            if num not in best or len(block) > len(best[num][1]):
                best[num] = (num, block, mat, page, col)

        print(f'Preguntas únicas: {len(best)}')

        questions = []
        skipped = []
        for num in sorted(best.keys()):
            num, block, mat, page, col = best[num]
            parsed = parse_question_block(block)

            stem = parsed['stem']
            opts = parsed['opts']
            answer = parsed['answer']

            if not stem or len(stem) < 10:
                skipped.append(num)
                continue
            if len(opts) < 2:
                skipped.append(num)
                continue

            # Limpiar dobles caracteres del stem (artefacto PDF)
            stem = re.sub(r'(.)\1+', lambda m: m.group(1) if len(m.group(0)) == 2 else m.group(0), stem)

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
                'explicacion': parsed['resol'],
                'tema': parsed['tema'],
                'pagina_pdf': page,
            }
            questions.append(q)
            print(f'  Q{num:3d} [{mat:20s}] {col} ans={answer} "{stem[:55]}..."')

        if skipped:
            print(f'\nSaltadas por datos insuficientes: {skipped}')

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    print(f'\nGuardado: {OUTPUT}  ({len(questions)} preguntas)')

if __name__ == '__main__':
    main()
