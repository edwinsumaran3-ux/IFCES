"""
Carga las 20,000 preguntas al banco de Railway.
Uso:
    python scripts/seed_questions.py

Requiere: pip install requests
"""
import json, sys, pathlib

try:
    import requests
except ImportError:
    print("Instala requests: pip install requests")
    sys.exit(1)

BASE      = "https://ifces-production.up.railway.app"
ADMIN_EMAIL    = "admin@icfes.edu.co"
ADMIN_PASSWORD = "Admin1234"
BATCH_SIZE     = 200

BANCO_FILE = pathlib.Path(__file__).parent.parent.parent / "icfes_bank_original_20000" / "banco_total_20000.json"

def login():
    r = requests.post(f"{BASE}/api/v1/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "role": "admin"},
                      timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]

def check_count(token):
    r = requests.get(f"{BASE}/api/v1/admin/questions/count",
                     headers={"Authorization": f"Bearer {token}"}, timeout=10)
    if r.ok:
        data = r.json()
        print(f"Preguntas actuales en DB: {data['total']}")
        for area, n in data.get("by_area", {}).items():
            print(f"  {area}: {n}")
    return r.ok and r.json().get("total", 0)

def upload(questions, token):
    total = len(questions)
    print(f"\nCargando {total} preguntas en lotes de {BATCH_SIZE}...")
    inserted = 0
    for i in range(0, total, BATCH_SIZE):
        batch = questions[i : i + BATCH_SIZE]
        r = requests.post(
            f"{BASE}/api/v1/admin/questions/batch",
            json=batch,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=60,
        )
        if r.ok:
            data = r.json()
            inserted += data.get("inserted", 0)
            pct = min(100, int((i + len(batch)) / total * 100))
            print(f"  [{pct:3d}%] lote {i//BATCH_SIZE + 1}: +{data.get('inserted',0)} insertadas, {data.get('skipped',0)} omitidas")
        else:
            print(f"  ERROR en lote {i//BATCH_SIZE + 1}: {r.status_code} {r.text[:200]}")
    return inserted

def main():
    if not BANCO_FILE.exists():
        print(f"No se encontró el archivo: {BANCO_FILE}")
        sys.exit(1)

    print(f"Leyendo {BANCO_FILE.name}...")
    with open(BANCO_FILE, encoding="utf-8") as f:
        questions = json.load(f)
    print(f"Leídas {len(questions)} preguntas.")

    print("Autenticando como administrador...")
    token = login()
    print("OK — token obtenido.")

    current = check_count(token)
    if current and current >= 1000:
        ans = input(f"\nYa hay {current} preguntas. ¿Cargar igualmente? (s/N): ").strip().lower()
        if ans != "s":
            print("Cancelado.")
            return

    uploaded = upload(questions, token)
    print(f"\nListo. {uploaded} preguntas nuevas cargadas.")
    check_count(token)

if __name__ == "__main__":
    main()
