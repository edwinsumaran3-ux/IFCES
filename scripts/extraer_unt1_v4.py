# -*- coding: utf-8 -*-
"""
Extrae Q1-Q100 de UNT1.pdf — versión 4 (corregida)
"""
import sys, io, re, json
import pdfplumber

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PDF_PATH   = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\UNT1.pdf'
OUTPUT     = r'c:\Users\USUARIO\Downloads\Pruebas ICFES,\PERU\preguntas_unt1_final.json'
PAGE_START = 317
PAGE_END   = 362
COLUMN_MID = 234.0

# ── Materia desde TEMA de resolución ─────────────────────────────────────────
TEMA_MATERIA = [
    (r'procesos afectivos|amor|sexualidad|identidad|percepción|inteligencia|hominización|enamoramiento|psicoanál|androgin', 'Psicología'),
    (r'servicio militar|organismos constitucionales|atribuciones.*consejo|atribuciones.*premier|defensa civil|defensa nacional|discriminación|proyecto de vida|violencia|ciudadan|constitución|derechos|estado|gobierno|migración|normas jurídicas', 'Desarrollo Personal'),
    (r'tectónica|placa|clima|bioma|amazón|ciudad.*peruana|geografía', 'Geografía'),
    (r'revolución|guerra|virreinato|inca|independencia|historia|siglo', 'Historia'),
    (r'pbi|inflación|oferta|demanda|moneda|dinero\b|indicadores económicos|subdesarrollo|interés.*compuesto|regla de interés', 'Economía'),
    (r'jerarquía textual|sentido contextual|inferencia textual|mecanismos de cohesión|pronombre|usos de la comilla|la coma|el adjetivo|el verbo|tildación|ortografía|sintaxis|semántica|lenguaje|lectura|comprensión lectora|comunicación|figuras literarias|registro', 'Lenguaje'),
    (r'literatura|género literario|realismo|narrativa|poesía|dramática|boom|novela', 'Literatura'),
    (r'there is|there are|reading|inglés|english|grammar|vocabulary|verb tense|present.*simple|past.*simple', 'Inglés'),
    (r'permutación|combinación|tanto por ciento|álgebra|geometría|trigonometr|cálculo|estadíst|probabilid|aritmét|cónica|sucesión|función|logaritm|polinomio|ecuaciones|progresión|proporcionalidad|operacion|regla de tres|interés\b', 'Matemática'),
    (r'cinemática|fuerza|newton|energía|trabajo mecánico|óptica|electromagnetismo|termodinámica|dinámica|movimiento|velocidad|aceleración', 'Física'),
    (r'nomenclatura|enlace|reacción|tabla periódica|funciones nitrogenadas|química|mol\b|estequio|ácido|base\b', 'Química'),
    (r'biología|célula|ecología|genética|biología celular|organelo|fotosíntes|respiración celular|ecosistema|evolución|herencia|sistema endocrino|hormona|lisosoma|cloroplasto', 'Biología'),
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
    # Formato multilinea: cada opción en su propia línea
    ml_pat = re.compile(r'(?:^|\n)\s*([A-E])\)\s*(.+?)(?=\n\s*[A-E]\)|\Z)', re.DOTALL)
    for m in ml_pat.finditer(text):
        lbl, val = m.group(1), clean(m.group(2).replace('\n', ' '))
        if val and len(val) < 400:
            opts[lbl] = val

    if len(opts) >= 3:
        return opts

    # Formato inline: "A) texto B) texto C) texto"
    opts2 = {}
    il_pat = re.compile(r'\b([A-E])\)\s*(.+?)(?=\s+[A-E]\)|\Z)')
    for m in il_pat.finditer(text):
        lbl, val = m.group(1), clean(m.group(2))
        if val:
            opts2[lbl] = val
    if len(opts2) > len(opts):
        return opts2
    return opts

def find_answer(resol: str, opts: dict) -> str:
    # 1) Letra directa: "Respuesta: D"
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*([A-E])\b', resol, re.IGNORECASE)
    if m:
        return m.group(1)

    # 2) Texto: "Respuesta: Storge"
    m = re.search(r'(?:Respuesta|Rpta\.?)\s*[:\-]\s*(.{1,150}?)(?:\n|$)', resol, re.IGNORECASE)
    if m:
        ans = clean(m.group(1))
        an  = re.sub(r'[^a-z0-9áéíóúüñ]', '', ans.lower())
        best, best_len = '', 0
        for lbl, opt in opts.items():
            on = re.sub(r'[^a-z0-9áéíóúüñ]', '', opt.lower())
            # Match si la respuesta está al inicio de la opción o viceversa
            if an and (on.startswith(an[:min(len(an),15)]) or an.startswith(on[:min(len(on),15)])):
                if len(an) > best_len:
                    best, best_len = lbl, len(an)
        if best:
            return best
        # Match numérico
        nums_a = re.findall(r'\d+', ans)
        for lbl, opt in opts.items():
            if nums_a and nums_a == re.findall(r'\d+', opt):
                return lbl

    # 3) Letra suelta al final
    tail = resol[-400:]
    m2 = re.search(r'\b([A-E])\s*(?:\n|$)', tail.strip())
    if m2 and m2.group(1) in opts:
        return m2.group(1)

    return list(opts.keys())[0] if opts else 'A'

def remove_pdf_header_doubles(text: str) -> str:
    """Solo elimina patrones de doble carácter en palabras del encabezado del PDF.
    Ejemplo: 'SSoolluucciioonnaarriioo' → 'Solucionario'
    Sólo aplica si una palabra tiene TODOS sus caracteres duplicados."""
    def fix_word(w):
        chars = list(w)
        # Detectar si cada par de caracteres es igual
        if len(chars) >= 4 and len(chars) % 2 == 0:
            pairs = [(chars[i], chars[i+1]) for i in range(0, len(chars), 2)]
            if all(a == b for a, b in pairs):
                return ''.join(a for a, _ in pairs)
        return w
    return ' '.join(fix_word(w) for w in text.split())

def parse_block(block: str):
    # Quitar encabezado "PREGUNTA N.º X" del inicio
    block = re.sub(r'^PREGUNTA\s+N[.º°ﾟ]+\s*\d+\s*', '', block, flags=re.IGNORECASE).strip()
    # Limpiar encabezados de doble carácter del PDF (ej: SSoolluucciioonnaarriioo)
    lines = []
    for line in block.split('\n'):
        line = remove_pdf_header_doubles(line)
        lines.append(line)
    block = '\n'.join(lines)

    # Separar pregunta de resolución
    resol_m = re.search(r'RESOLUCI[OÓ]N', block, re.IGNORECASE)
    if resol_m:
        q_part = block[:resol_m.start()].strip()
        r_part = block[resol_m.end():].strip()
    else:
        q_part = block.strip()
        r_part = ''

    # Enunciado: antes de la primera opción
    first_opt_m = re.search(r'(?:^|\n)\s*[A-E]\)', q_part)
    if first_opt_m:
        stem = clean(q_part[:first_opt_m.start()].replace('\n', ' '))
        opts = parse_options(q_part[first_opt_m.start():])
    else:
        # Opciones inline en el stem
        inline_m = re.search(r'\s+[A-E]\)\s', q_part)
        if inline_m:
            stem = clean(q_part[:inline_m.start()])
            opts = parse_options(q_part[inline_m.start():])
        else:
            stem = clean(q_part.replace('\n', ' '))
            opts = {}

    # Quitar patrones de materia/sección del inicio del stem
    stem = re.sub(r'^(Ciencias\s+\w[\w\s]*?|matemátic\w+|física|química|biolog\w+|lenguaje\w*|literatur\w+|histori\w+|filosof\w+|psicolog\w+|economí\w+|inglés|inglés)\s*', '', stem, flags=re.IGNORECASE).strip()
    stem = clean(stem)

    # Tema
    tema_m = re.search(r'Tema\s*[:\-]\s*(.+?)(?:\n|$)', r_part, re.IGNORECASE)
    tema = clean(tema_m.group(1)) if tema_m else ''

    answer = find_answer(r_part, opts)

    # Limpiar resolución
    resol_clean = re.sub(r'(?:Respuesta|Rpta\.?)\s*[:\-].*', '', r_part, flags=re.IGNORECASE).strip()
    resol_clean = clean(resol_clean)

    return stem, opts, answer, tema, resol_clean

def main():
    print(f'Abriendo {PDF_PATH} ...')
    with pdfplumber.open(PDF_PATH) as pdf:
        total = len(pdf.pages)

        # Stream: LEFT p317, RIGHT p317, LEFT p318, RIGHT p318 ...
        full_parts = []
        for pi in range(PAGE_START, min(PAGE_END, total)):
            page = pdf.pages[pi]
            words = page.extract_words(x_tolerance=3, y_tolerance=3) or []
            lw = [w for w in words if w['x0'] <  COLUMN_MID]
            rw = [w for w in words if w['x0'] >= COLUMN_MID]
            full_parts.append(words_to_text(lw))
            full_parts.append(words_to_text(rw))

        full = '\n'.join(full_parts)

        # Dividir por PREGUNTA N.º X
        Q_PAT = r'PREGUNTA\s+N[.º°ﾟ]+\s*(\d+)'
        q_marks = list(re.finditer(Q_PAT, full, re.IGNORECASE))
        print(f'Marcadores encontrados: {len(q_marks)}')

        raw_blocks = {}
        for idx, qm in enumerate(q_marks):
            num = int(qm.group(1))
            start = qm.start()
            end   = q_marks[idx+1].start() if idx+1 < len(q_marks) else len(full)
            block = full[start:end]
            if num not in raw_blocks or len(block) > len(raw_blocks[num]):
                raw_blocks[num] = block

        questions = []
        skipped   = []
        for num in sorted(raw_blocks.keys()):
            if num > 100:
                continue
            block = raw_blocks[num]
            stem, opts, answer, tema, resol = parse_block(block)

            if not stem or len(stem) < 8:
                skipped.append(num); continue
            if len(opts) < 2:
                # Último intento: buscar opciones en todo el bloque
                opts = parse_options(block)
                if len(opts) < 2:
                    skipped.append(num); continue

            mat = materia_from_tema(tema, stem)

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
            print(f'  Q{num:3d} [{mat:22s}] ans={answer}  "{stem[:50]}"')

        if skipped:
            print(f'\nSALTADAS: {skipped}')
        print(f'\nTotal extraídas: {len(questions)}')

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    print(f'Guardado: {OUTPUT}')

if __name__ == '__main__':
    main()
