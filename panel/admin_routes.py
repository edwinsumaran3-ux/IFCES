# src/api/routes/admin.py
from __future__ import annotations
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from passlib.context import CryptContext
from src.infrastructure.database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class CreateUserRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "student"
    plan_code: str = "basic"

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

    tenant = (await db.execute(text("SELECT id FROM tenants LIMIT 1"))).fetchone()
    if not tenant:
        raise HTTPException(status_code=500, detail="No hay tenant configurado")

    user_id = str(uuid4())
    hashed = pwd_context.hash(body.password)
    await db.execute(
        text("""
            INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, plan_code, created_at)
            VALUES (:id, :tenant_id, :email, :hash, :name, :role, true, :plan, NOW())
        """),
        {"id": user_id, "tenant_id": str(tenant.id),
         "email": body.email.lower().strip(), "hash": hashed,
         "name": body.full_name, "role": body.role, "plan": body.plan_code}
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
    try:
        payment_id = str(uuid4())
        await db.execute(
            text("""
                INSERT INTO payments (id, user_id, plan_code, amount_cop, nequi_ref, status, created_at)
                VALUES (:id, :user_id, :plan, :amount, :ref, 'pending', NOW())
            """),
            {"id": payment_id, "user_id": body.user_id,
             "plan": body.plan_code, "amount": body.amount,
             "ref": body.nequi_ref}
        )
        await db.commit()
        return {"success": True, "payment_id": payment_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

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
