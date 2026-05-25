#!/usr/bin/env python3
"""
cargar_banco_icfes.py
Lee los 5 PDFs del banco de preguntas Saber 11 y los carga en PostgreSQL.
Uso:
    python cargar_banco_icfes.py --pdf-dir data --dbname icfes_db --user postgres --password postgres
"""

import argparse
import re
import sys
from pathlib import Path

import pdfplumber
import psycopg2

PDF_FILES = {
    "Matematicas":              "banco_matematicas_4000.pdf",
    "Lectura critica":          "banco_lectura_critica_4000.pdf",
    "Ciencias naturales":       "banco_ciencias_naturales_4000.pdf",
    "Sociales y ciudadanas":    "banco_sociales_y_ciudadanas_4000.pdf",
    "Ingles":                   "banco_ingles_4000.pdf",
}

DDL = """
CREATE TABLE IF NOT EXISTS preguntas_icfes (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(10)  NOT NULL UNIQUE,
    area            VARCHAR(60)  NOT NULL,
    dificultad      VARCHAR(20)  NOT NULL,
    competencia     VARCHAR(100) NOT NULL,
    tema            VARCHAR(100) NOT NULL,
    enunciado       TEXT         NOT NULL,
    opcion_a        TEXT         NOT NULL,
    opcion_b        TEXT         NOT NULL,
    opcion_c        TEXT         NOT NULL,
    opcion_d        TEXT         NOT NULL,
    respuesta       CHAR(1)      NOT NULL,
    explicacion     TEXT         NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_preguntas_area ON preguntas_icfes(area);
"""

INSERT_SQL = """
INSERT INTO preguntas_icfes
    (codigo, area, dificultad, competencia, tema,
     enunciado, opcion_a, opcion_b, opcion_c, opcion_d,
     respuesta, explicacion)
VALUES
    (%(codigo)s, %(area)s, %(dificultad)s, %(competencia)s, %(tema)s,
     %(enunciado)s, %(opcion_a)s, %(opcion_b)s, %(opcion_c)s, %(opcion_d)s,
     %(respuesta)s, %(explicacion)s)
ON CONFLICT (codigo) DO NOTHING;
"""

HEADER_RE = re.compile(
    r'^(Q\d{5})\s*\|\s*(.+?)\s*\|\s*(MEDIA|ALTA|RETO)\s*\|\s*(.+?)\s*\|\s*(.+)$'
)
OPTION_RE = re.compile(r'^([ABCD])[.)]\s+(.+)$')
ANSWER_RE = re.compile(
    r'^Respuesta:\s*([ABCD])[.)]\s+Explicacion:\s*(.+)$', re.DOTALL
)


def parse_block(lines):
    if not lines:
        return None
    m = HEADER_RE.match(lines[0].strip())
    if not m:
        return None
    codigo, area, dificultad, competencia, tema = m.groups()
    options = {}
    enunciado_parts = []
    respuesta = explicacion = ""
    i = 1
    while i < len(lines):
        line = lines[i].strip()
        m_ans = ANSWER_RE.match(line)
        if m_ans:
            respuesta = m_ans.group(1)
            explicacion = m_ans.group(2).strip()
            i += 1
            while i < len(lines):
                next_line = lines[i].strip()
                if not next_line:
                    break
                explicacion += " " + next_line
                i += 1
            continue
        m_opt = OPTION_RE.match(line)
        if m_opt:
            options[m_opt.group(1)] = m_opt.group(2).strip()
            i += 1
            continue
        if line:
            enunciado_parts.append(line)
        i += 1
    if len(options) != 4 or not respuesta:
        return None
    return {
        "codigo":      codigo,
        "area":        area,
        "dificultad":  dificultad,
        "competencia": competencia,
        "tema":        tema,
        "enunciado":   " ".join(enunciado_parts),
        "opcion_a":    options.get("A", ""),
        "opcion_b":    options.get("B", ""),
        "opcion_c":    options.get("C", ""),
        "opcion_d":    options.get("D", ""),
        "respuesta":   respuesta,
        "explicacion": explicacion,
    }


def extract_questions(pdf_path):
    questions = []
    current_block = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw_line in text.splitlines():
                line = raw_line.strip()
                if HEADER_RE.match(line):
                    if current_block:
                        q = parse_block(current_block)
                        if q:
                            questions.append(q)
                    current_block = [line]
                else:
                    if current_block:
                        current_block.append(line)
        if current_block:
            q = parse_block(current_block)
            if q:
                questions.append(q)
    return questions


def load_to_db(questions, conn):
    inserted = skipped = 0
    with conn.cursor() as cur:
        for q in questions:
            cur.execute(INSERT_SQL, q)
            if cur.rowcount:
                inserted += 1
            else:
                skipped += 1
    conn.commit()
    return inserted, skipped


def parse_args():
    p = argparse.ArgumentParser(description="Carga banco ICFES en PostgreSQL")
    p.add_argument("--pdf-dir",  default=".")
    p.add_argument("--host",     default="localhost")
    p.add_argument("--port",     default=5433, type=int)
    p.add_argument("--dbname",   default="icfes_db")
    p.add_argument("--user",     default="postgres")
    p.add_argument("--password", default="")
    p.add_argument("--dry-run",  action="store_true")
    return p.parse_args()


def main():
    args = parse_args()
    pdf_dir = Path(args.pdf_dir)

    if not args.dry_run:
        try:
            conn = psycopg2.connect(
                host=args.host, port=args.port,
                dbname=args.dbname, user=args.user, password=args.password
            )
        except (psycopg2.OperationalError, UnicodeDecodeError) as e:
            if isinstance(e, UnicodeDecodeError):
                sys.exit(
                    f"[ERROR] No se pudo conectar a PostgreSQL (host={args.host}, "
                    f"puerto={args.port}, bd={args.dbname}, usuario={args.user}).\n"
                    f"El mensaje de error de PostgreSQL contiene caracteres especiales "
                    f"(español) que psycopg2 no puede decodificar.\n"
                    f"Verifica: 1) contraseña correcta  2) que la BD '{args.dbname}' exista"
                )
            sys.exit(f"[ERROR] No se pudo conectar: {e}")
        with conn.cursor() as cur:
            cur.execute(DDL)
        conn.commit()
        print(f"[OK] Tabla verificada en '{args.dbname}'.\n")
    else:
        conn = None
        print("[DRY-RUN] Sin escritura en DB.\n")

    total_inserted = total_skipped = total_parsed = 0

    for area, filename in PDF_FILES.items():
        pdf_path = pdf_dir / filename
        if not pdf_path.exists():
            print(f"[WARN] No encontrado: {pdf_path}")
            continue
        print(f"Procesando: {filename} ({area})")
        questions = extract_questions(pdf_path)
        total_parsed += len(questions)
        print(f"   Parseadas: {len(questions)}")
        if not args.dry_run and questions:
            ins, skip = load_to_db(questions, conn)
            total_inserted += ins
            total_skipped  += skip
            print(f"   Insertadas: {ins} | Omitidas: {skip}")

    print(f"\n{'='*50}")
    print(f"Total parseadas : {total_parsed}")
    if not args.dry_run:
        print(f"Total insertadas: {total_inserted}")
        print(f"Total omitidas  : {total_skipped}")
        conn.close()
    print("Listo!")


if __name__ == "__main__":
    main()
