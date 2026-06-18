from __future__ import annotations
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from src.infrastructure.database import get_db

router = APIRouter(prefix="/peru", tags=["Peru Payments"])

class PeruPaymentRequest(BaseModel):
    user_id:   str
    plan_code: str = "pro"
    amount:    int = 15          # S/ 15 soles
    voucher:   str               # número de operación Yape/Plin/Efectivo
    metodo:    str = "yape"      # yape | plin | efectivo

@router.post("/payments")
async def create_peru_payment(body: PeruPaymentRequest, db=Depends(get_db)):
    voucher = body.voucher.strip()
    if not voucher:
        raise HTTPException(status_code=400, detail="El número de operación es requerido")

    # Verificar voucher no duplicado
    existing = (await db.execute(
        text("SELECT id, status FROM payments WHERE nequi_ref=:ref"),
        {"ref": voucher}
    )).fetchone()
    if existing:
        msg = "Este voucher ya fue aprobado." if existing.status == "approved" \
              else "Este voucher ya está registrado y pendiente de confirmación."
        raise HTTPException(status_code=400, detail=msg)

    # Verificar pago pendiente previo
    pending = (await db.execute(
        text("SELECT id FROM payments WHERE user_id=:uid AND status='pending' AND pais='PE'"),
        {"uid": body.user_id}
    )).fetchone()
    if pending:
        raise HTTPException(
            status_code=400,
            detail="Ya tienes un pago pendiente. Espera que el administrador lo confirme."
        )

    payment_id = str(uuid4())
    try:
        await db.execute(text("""
            INSERT INTO payments (id, user_id, plan_code, amount_cop, nequi_ref, status, pais, metodo_pago, created_at)
            VALUES (:id, :uid, :plan, :amount, :voucher, 'pending', 'PE', :metodo, NOW())
        """), {
            "id":      payment_id,
            "uid":     body.user_id,
            "plan":    body.plan_code,
            "amount":  body.amount,
            "voucher": voucher,
            "metodo":  body.metodo,
        })
        await db.commit()
        return {"success": True, "payment_id": payment_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/payments")
async def get_peru_payments(db=Depends(get_db)):
    try:
        rows = (await db.execute(text("""
            SELECT p.id, u.full_name as student_name, u.email,
                   p.plan_code, p.amount_cop, p.nequi_ref as voucher,
                   p.metodo_pago, p.status, p.created_at
            FROM payments p
            JOIN users u ON u.id = p.user_id
            WHERE p.pais = 'PE'
            ORDER BY p.created_at DESC
        """))).fetchall()
        return {"payments": [
            {
                "id":           str(r.id),
                "student_name": r.student_name,
                "email":        r.email,
                "plan_code":    r.plan_code,
                "amount":       r.amount_cop,
                "voucher":      r.voucher,
                "metodo":       r.metodo_pago or "yape",
                "status":       r.status,
                "created_at":   str(r.created_at),
            }
            for r in rows
        ]}
    except Exception as e:
        return {"payments": [], "error": str(e)}


@router.post("/admin/payments/{payment_id}/approve")
async def approve_peru_payment(payment_id: str, db=Depends(get_db)):
    payment = (await db.execute(
        text("SELECT * FROM payments WHERE id=:id AND pais='PE'"),
        {"id": payment_id}
    )).fetchone()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    await db.execute(
        text("UPDATE payments SET status='approved' WHERE id=:id"),
        {"id": payment_id}
    )
    # Activar plan del usuario Peru
    await db.execute(
        text("UPDATE users SET is_active=true, plan_code=:plan WHERE id=:uid"),
        {"plan": payment.plan_code, "uid": str(payment.user_id)}
    )
    await db.commit()
    return {"success": True}


@router.post("/admin/payments/{payment_id}/reject")
async def reject_peru_payment(payment_id: str, db=Depends(get_db)):
    payment = (await db.execute(
        text("SELECT id FROM payments WHERE id=:id AND pais='PE'"),
        {"id": payment_id}
    )).fetchone()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    await db.execute(
        text("UPDATE payments SET status='rejected' WHERE id=:id"),
        {"id": payment_id}
    )
    await db.commit()
    return {"success": True}
