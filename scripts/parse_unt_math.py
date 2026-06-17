# -*- coding: utf-8 -*-
"""
Parse UNT1.pdf to extract math questions (Matemática sections).
Outputs JSON ready to INSERT into peru_preguntas table.
"""
import sys
import re
import json
import pdfplumber

PDF_PATH = "PERU/UNT1.pdf"
OUTPUT_PATH = "PERU/preguntas_matematica_extra.json"

# Pages detected with math content
MATH_PAGE_RANGES = list(range(39, 70)) + list(range(77, 145)) + list(range(136, 200))

def clean(s):
    if not s:
        return ""
    # Normalize whitespace
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def extract_all_math_pages(pdf):
    texts = []
    for i, page in enumerate(pdf.pages):
        t = page.extract_text() or ""
        if "matem" in t.lower() and len(t) > 50:
            texts.append((i + 1, t))
    return texts

def find_question_blocks(full_text):
    """
    Split full text into question blocks.
    Each block starts with 'PREGUNTA N.' or a question number pattern.
    Handles garbled/replacement characters for '°'.
    """
    # The PDF decodes '°' as replacement char � or similar; match anything
    text = re.sub(r'PREGUNTA\s+N\.?\S?\s*', 'PREGUNTA_NUM_', full_text, flags=re.IGNORECASE)

    # Split on PREGUNTA_NUM_
    parts = re.split(r'(?=PREGUNTA_NUM_\d+)', text)
    blocks = []
    for part in parts:
        m = re.match(r'PREGUNTA_NUM_(\d+)', part)
        if m:
            num = int(m.group(1))
            content = part[m.end():].strip()
            blocks.append((num, content))
    return blocks

def parse_options(text):
    """Extract A B C D E options from text."""
    opts = {}
    # Pattern: A) text  B) text  etc
    matches = list(re.finditer(r'\b([A-E])\)\s*(.+?)(?=\s+[A-E]\)|RESOLUCI[OÓ]N|$)', text, re.DOTALL))
    for m in matches:
        lbl = m.group(1)
        val = clean(m.group(2))
        # Remove trailing junk
        val = re.sub(r'\s*(RESOLUCI[OÓ]N.*|PREGUNTA.*)$', '', val, flags=re.DOTALL | re.IGNORECASE).strip()
        if val and lbl in 'ABCDE':
            opts[lbl] = val
    return opts

def parse_resolution(text):
    """Extract resolution/answer block."""
    m = re.search(r'RESOLUCI[OÓ]N\s*(.+?)(?=PREGUNTA_NUM_\d+|$)', text, re.DOTALL | re.IGNORECASE)
    if m:
        return clean(m.group(1))
    return ""

def extract_correct_answer(resolution_text, options):
    """
    Try to find the correct answer letter from resolution text.
    UNT resolutions often say 'Respuesta: 48' (the value, not the letter).
    Match the resolved value against options to find the letter.
    """
    # 1) Explicit letter: "Rpta: C", "Respuesta: C"
    for pattern in [
        r'[Rr]pta\.?\s*[:=]\s*([A-E])\b',
        r'[Rr]espuesta\.?\s*[:=]\s*([A-E])\b',
        r'[Cc]lave\.?\s*[:=]\s*([A-E])\b',
        r'\bRpta\s*([A-E])\b',
    ]:
        m = re.search(pattern, resolution_text, re.IGNORECASE)
        if m:
            return m.group(1).upper()

    # 2) UNT format "Respuesta: 48" → match value to options
    val_m = re.search(r'[Rr]espuesta\s*[:=]\s*(.{1,40})', resolution_text)
    if val_m:
        val_raw = val_m.group(1).strip()
        # Remove trailing whitespace/newlines
        val_raw = val_raw.split('\n')[0].strip()
        # Try to match against each option text
        for lbl, opt_text in options.items():
            # Normalize both for comparison
            val_norm = re.sub(r'[\s,.]', '', val_raw).lower()
            opt_norm = re.sub(r'[\s,.]', '', opt_text).lower()
            if val_norm and val_norm in opt_norm or opt_norm in val_norm:
                return lbl
            # Also try numeric match
            nums_val = re.findall(r'\d+', val_raw)
            nums_opt = re.findall(r'\d+', opt_text)
            if nums_val and nums_val == nums_opt:
                return lbl

    # 3) Last resort: lone letter near end
    tail = resolution_text[-300:] if len(resolution_text) > 300 else resolution_text
    m = re.search(r'\b([A-E])\)\s*$', tail.strip())
    if m and m.group(1) in options:
        return m.group(1)

    return list(options.keys())[0] if options else "A"  # fallback to first option

def parse_question_block(num, content):
    """Parse a single question block into a dict."""
    # Split: enunciado / opciones / resolución
    resol_match = re.search(r'RESOLUCI[OÓ]N', content, re.IGNORECASE)
    resol_start = resol_match.start() if resol_match else len(content)
    before_resol = content[:resol_start]
    after_resol = content[resol_start:]

    # Options from before_resol
    options = parse_options(before_resol)

    # Stem: everything before the first option letter
    stem_end = len(before_resol)
    first_opt = re.search(r'\b[A-E]\)\s', before_resol)
    if first_opt:
        stem_end = first_opt.start()
    stem = clean(before_resol[:stem_end])
    # Remove question-context preamble (like "UNT 2025-I ...  matemática")
    stem = re.sub(r'^(UNT\s+\d+[-–]\w+\s+.{0,80}?\s+)?matem[áa]ti\w+\s*', '', stem, flags=re.IGNORECASE).strip()

    resolution = parse_resolution(after_resol)
    answer = extract_correct_answer(resolution, options)

    if not stem or len(stem) < 10 or not options:
        return None

    return {
        "seccion": "A",
        "materia": "Matemática",
        "enunciado": stem,
        "opcion_a": options.get("A", ""),
        "opcion_b": options.get("B", ""),
        "opcion_c": options.get("C", ""),
        "opcion_d": options.get("D", ""),
        "opcion_e": options.get("E", ""),
        "respuesta": answer,
        "explicacion": resolution,
        "numero_pregunta": num,
    }

def main():
    print(f"Opening {PDF_PATH} ...")
    with pdfplumber.open(PDF_PATH) as pdf:
        total = len(pdf.pages)
        print(f"Total pages: {total}")

        # Collect all math pages text
        print("Collecting math pages...")
        page_texts = []
        for i, page in enumerate(pdf.pages):
            t = page.extract_text() or ""
            if "matem" in t.lower() or "MATEM" in t:
                page_texts.append(t)

        full_text = "\n".join(page_texts)
        print(f"Total math text length: {len(full_text)} chars")

        # Parse question blocks
        blocks = find_question_blocks(full_text)
        print(f"Found {len(blocks)} question blocks")

        questions = []
        seen_nums = set()
        for num, content in blocks:
            if num in seen_nums:
                continue
            seen_nums.add(num)
            q = parse_question_block(num, content)
            if q:
                questions.append(q)

    print(f"\nParsed {len(questions)} valid math questions")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    print(f"Saved to {OUTPUT_PATH}")

    # Show summary (ASCII-safe)
    for q in questions[:5]:
        stem_safe = q['enunciado'][:80].encode('ascii', 'replace').decode('ascii')
        print(f"  Q{q['numero_pregunta']}: ans={q['respuesta']} - {stem_safe}")

if __name__ == "__main__":
    main()
