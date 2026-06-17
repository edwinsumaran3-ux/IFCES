from __future__ import annotations
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
import bcrypt as _bcrypt
from jose import jwt
from src.infrastructure.database import get_db

router = APIRouter(prefix="/peru/auth", tags=["Peru Auth"])
SECRET    = "tesla-pro-peru-secret-2026"
ALGORITHM = "HS256"

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""

def _verify(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def _token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)

def _user_dict(user) -> dict:
    return {
        "id":        str(user.id),
        "email":     user.email,
        "full_name": getattr(user, "full_name", None) or user.email,
        "role":      getattr(user, "role", "student"),
        "plan_code": getattr(user, "plan_code", None) or "pending",
        "country":   "PE",
    }

@router.post("/login")
async def peru_login(body: LoginRequest, db=Depends(get_db)):
    email = body.email.lower().strip()
    try:
        user = (await db.execute(
            text("SELECT * FROM users WHERE email=:email AND country='PE'"),
            {"email": email}
        )).fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if not _verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    ud = _user_dict(user)
    tok = _token({"sub": ud["id"], "email": ud["email"], "role": ud["role"], "name": ud["full_name"], "plan_code": ud["plan_code"], "country": "PE"})
    return {"access_token": tok, "token_type": "bearer", "user": ud}

@router.post("/register")
async def peru_register(body: RegisterRequest, db=Depends(get_db)):
    email = body.email.lower().strip()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="Email y contraseña requeridos")
    existing = (await db.execute(
        text("SELECT id FROM users WHERE email=:email"), {"email": email}
    )).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una cuenta con ese correo")
    hashed    = _bcrypt.hashpw(body.password.encode(), _bcrypt.gensalt()).decode()
    full_name = (body.full_name or "").strip() or email
    try:
        result = await db.execute(text("""
            INSERT INTO users (email, password_hash, full_name, role, status, plan_code, country)
            VALUES (:email, :hash, :full_name, 'student', 'active', 'pending', 'PE')
            RETURNING id, email, full_name, role, plan_code
        """), {"email": email, "hash": hashed, "full_name": full_name})
        await db.commit()
        user = result.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear cuenta: {str(e)}")
    ud  = {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role, "plan_code": "pending", "country": "PE"}
    tok = _token({"sub": ud["id"], "email": ud["email"], "role": ud["role"], "name": ud["full_name"], "plan_code": ud["plan_code"], "country": "PE"})
    return {"access_token": tok, "token_type": "bearer", "user": ud}
