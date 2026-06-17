import pdfplumber, re, json
from collections import Counter

SECCION_KW = {
    'B': ['matem','fisic','quimic','biolog','aritm','geomet','trigonom','algebra','calculo'],
    'A': ['personal','ciudadan','filosof','psicolog','historia','geograf','econom',
          'comunicac','lenguaje','literatur','ingles','etica','social'],
}

def normalize(t):
    import unicodedata
    return unicodedata.normalize('NFD', str(t)).encode('ascii','ignore').decode().lower()

def detect_sec(subj):
    ns = normalize(subj)
    for sec, kws in SECCION_KW.items():
        if any(k in ns for k in kws):
            return sec
    return 'A'

SUBJ_RE = re.compile(
    r'(?i)(matem[aá]tic\w*|f[ii]sic\w*|qu[ii]mic\w*|biolog[ii]\w*|lenguaje|'
    r'literatur\w*|ingl[ee]s|histor[a-z]*|geograf[a-z]*|filosof[a-z]*|econom[a-z]*|'
    r'psicolog[a-z]*|comunicaci[a-z]*|desarrollo personal|ciudadan[a-z]*|[ee]tica|'
    r'razonamiento\s+\w+)'
)

all_qs = []
current_subject = 'General'

with pdfplumber.open('PERU/UNT1.pdf') as pdf:
    for page in pdf.pages:
        w = page.width
        full_t = page.extract_text() or ''
        m = SUBJ_RE.search(full_t[:400])
        if m:
            current_subject = m.group(0).strip().capitalize()

        for x0, x1 in [(0, w*0.52), (w*0.48, w)]:
            col = page.crop((x0, 0, x1, page.height))
            t   = col.extract_text() or ''
            if not t.strip():
                continue
            cm = SUBJ_RE.search(t[:200])
            if cm:
                current_subject = cm.group(0).strip().capitalize()

            parts = re.split(r'PREGUNTA\s+N.{1,5}(\d+)', t)
            for j in range(1, len(parts), 2):
                block = parts[j+1] if j+1 < len(parts) else ''
                sm = re.split(r'\nA\)', block, 1)
                if len(sm) < 2:
                    continue
                stem = re.split(r'RESOLUCI', sm[0])[0].strip()
                if len(stem) < 12:
                    continue

                after = 'A)' + sm[1]
                opts_raw = re.split(r'RESOLUCI', after)[0]
                opts = {}
                for mo in re.finditer(r'([A-E])\)\s*(.*?)(?=[A-E]\)|$)', opts_raw, re.DOTALL):
                    txt = re.sub(r'\s+', ' ', mo.group(2)).strip()[:200]
                    if txt:
                        opts[mo.group(1)] = txt
                if len(opts) < 2:
                    continue

                rm = re.search(r'Respuesta:\s*([A-E])', block)
                resp = rm.group(1) if rm else 'A'
                em = re.search(r'RESOLUCI[OO]N\s*(.*?)(?:Respuesta:|$)', block, re.DOTALL)
                expl = re.sub(r'\s+', ' ', em.group(1)).strip()[:400] if em else ''

                bm = SUBJ_RE.search(block[:150])
                subj = bm.group(0).strip().capitalize() if bm else current_subject

                all_qs.append({
                    'seccion':   detect_sec(subj),
                    'materia':   subj,
                    'enunciado': re.sub(r'\s+', ' ', stem)[:700],
                    'opcion_a':  opts.get('A', '')[:250],
                    'opcion_b':  opts.get('B', '')[:250],
                    'opcion_c':  opts.get('C', '')[:250],
                    'opcion_d':  opts.get('D', '')[:250],
                    'respuesta': resp,
                    'explicacion': expl,
                })

print('Total:', len(all_qs))
print('Secciones:', dict(Counter(q['seccion'] for q in all_qs)))
print('Top materias:', dict(list(Counter(q['materia'] for q in all_qs).most_common(12))))

with open('PERU/preguntas_unt.json', 'w', encoding='utf-8') as f:
    json.dump(all_qs, f, ensure_ascii=False, indent=2)
print('Guardado en PERU/preguntas_unt.json')
