# src/api/routes/admin.py
from __future__ import annotations
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
import bcrypt as _bcrypt
from src.infrastructure.database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"])

class CreateUserRequest(BaseModel):
    full_name:    str
    email:        str
    password:     str
    role:         str = "student"
    plan_code:    str = "basic"
    country:      str = "CO"
    institution:  str = ""

class PaymentRequest(BaseModel):
    user_id: str
    plan_code: str
    amount: int
    nequi_ref: str

@router.get("/users")
async def get_users(db=Depends(get_db)):
    rows = (await db.execute(text("""
        SELECT id, full_name, email, role, is_active, plan_code, created_at
        FROM users ORDER BY created_at DESC
    """))).fetchall()
    return {"users": [
        {"id": str(r.id), "full_name": r.full_name or r.email,
         "email": r.email, "role": r.role,
         "is_active": r.is_active, "plan_code": r.plan_code or "basic",
         "created_at": str(r.created_at)}
        for r in rows
    ]}

@router.post("/users")
async def create_user(body: CreateUserRequest, db=Depends(get_db)):
    existing = (await db.execute(
        text("SELECT id FROM users WHERE email=:email"),
        {"email": body.email.lower().strip()}
    )).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya existe")

    user_id = str(uuid4())
    hashed  = _bcrypt.hashpw(body.password.encode(), _bcrypt.gensalt()).decode()
    country = getattr(body, 'country', 'CO')
    await db.execute(
        text("""
            INSERT INTO users (id, email, password_hash, full_name, role, is_active, plan_code, country, status, created_at)
            VALUES (:id, :email, :hash, :name, :role, true, :plan, :country, 'active', NOW())
        """),
        {"id": user_id, "email": body.email.lower().strip(), "hash": hashed,
         "name": body.full_name, "role": body.role, "plan": body.plan_code, "country": country}
    )
    await db.commit()
    return {"success": True, "user_id": user_id}

@router.post("/users/{user_id}/toggle")
async def toggle_user(user_id: str, body: dict, db=Depends(get_db)):
    await db.execute(
        text("UPDATE users SET is_active=:active WHERE id=:id"),
        {"active": body.get("is_active", True), "id": user_id}
    )
    await db.commit()
    return {"success": True}

@router.get("/payments")
async def get_payments(db=Depends(get_db)):
    try:
        rows = (await db.execute(text("""
            SELECT p.id, u.full_name as student_name, p.plan_code as plan,
                   p.amount_cop as amount, p.nequi_ref, p.status, p.created_at
            FROM payments p
            JOIN users u ON u.id = p.user_id
            WHERE p.pais = 'CO' OR p.pais IS NULL
            ORDER BY p.created_at DESC
        """))).fetchall()
        return {"payments": [
            {"id": str(r.id), "student_name": r.student_name,
             "plan": r.plan, "amount": r.amount,
             "nequi_ref": r.nequi_ref, "status": r.status,
             "created_at": str(r.created_at)}
            for r in rows
        ]}
    except:
        return {"payments": []}

@router.post("/payments")
async def create_payment(body: PaymentRequest, db=Depends(get_db)):
    ref = body.nequi_ref.strip()
    if not ref:
        raise HTTPException(status_code=400, detail="La referencia Nequi es requerida")

    # Verificar que la referencia no haya sido usada antes
    existing = (await db.execute(
        text("SELECT id, status FROM payments WHERE nequi_ref = :ref"),
        {"ref": ref}
    )).fetchone()
    if existing:
        if existing.status == "approved":
            raise HTTPException(
                status_code=400,
                detail="Esta referencia Nequi ya fue utilizada y aprobada. Cada pago tiene un código único."
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Esta referencia Nequi ya está registrada y en espera de confirmación."
            )

    # Verificar que el usuario no tenga ya un pago pendiente
    pending = (await db.execute(
        text("SELECT id FROM payments WHERE user_id=:uid AND status='pending'"),
        {"uid": body.user_id}
    )).fetchone()
    if pending:
        raise HTTPException(
            status_code=400,
            detail="Ya tienes un pago pendiente de confirmación. Espera que el administrador lo apruebe."
        )

    try:
        payment_id = str(uuid4())
        await db.execute(
            text("""
                INSERT INTO payments (id, user_id, plan_code, amount_cop, nequi_ref, status, created_at)
                VALUES (:id, :user_id, :plan, :amount, :ref, 'pending', NOW())
            """),
            {"id": payment_id, "user_id": body.user_id,
             "plan": body.plan_code, "amount": body.amount,
             "ref": ref}
        )
        await db.commit()
        return {"success": True, "payment_id": payment_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/questions/batch")
async def import_questions_batch(questions: list[dict], db=Depends(get_db)):
    inserted = 0
    skipped  = 0
    for q in questions:
        opts = {o["label"].upper(): o["text"] for o in q.get("options", [])}
        try:
            await db.execute(text("""
                INSERT INTO preguntas_icfes
                    (codigo, area, enunciado, opcion_a, opcion_b, opcion_c, opcion_d,
                     respuesta, explicacion, dificultad)
                VALUES (:codigo, :area, :enunciado, :a, :b, :c, :d, :resp, :expl, :dif)
                ON CONFLICT DO NOTHING
            """), {
                "codigo":    q.get("id", ""),
                "area":      q.get("area", ""),
                "enunciado": q.get("stem", ""),
                "a": opts.get("A", ""), "b": opts.get("B", ""),
                "c": opts.get("C", ""), "d": opts.get("D", ""),
                "resp": (q.get("correct_option") or "A").upper(),
                "expl": q.get("explanation", ""),
                "dif":  (q.get("difficulty") or "MEDIA").upper(),
            })
            inserted += 1
        except Exception:
            skipped += 1
    await db.commit()
    return {"inserted": inserted, "skipped": skipped}

@router.get("/questions/count")
async def count_questions(db=Depends(get_db)):
    try:
        row = (await db.execute(text(
            "SELECT COUNT(*) AS n, area FROM preguntas_icfes GROUP BY area ORDER BY area"
        ))).fetchall()
        total = sum(r.n for r in row)
        return {"total": total, "by_area": {r.area: r.n for r in row}}
    except Exception:
        return {"total": 0, "by_area": {}}

@router.post("/payments/{payment_id}/approve")
async def approve_payment(payment_id: str, db=Depends(get_db)):
    payment = (await db.execute(
        text("SELECT * FROM payments WHERE id=:id"),
        {"id": payment_id}
    )).fetchone()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    await db.execute(
        text("UPDATE payments SET status='approved' WHERE id=:id"),
        {"id": payment_id}
    )
    await db.execute(
        text("UPDATE users SET is_active=true, plan_code=:plan WHERE id=:user_id"),
        {"plan": payment.plan_code, "user_id": str(payment.user_id)}
    )
    await db.commit()
    return {"success": True}


