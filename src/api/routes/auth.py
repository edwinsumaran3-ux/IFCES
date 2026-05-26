from __future__ import annotations
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
import bcrypt as _bcrypt
from jose import jwt
from src.infrastructure.database import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])
SECRET = "icfes-neuro-ia-secret-2026"
ALGORITHM = "HS256"

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str = "admin"

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def create_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(to_encode, SECRET, algorithm=ALGORITHM)

@router.post("/login")
async def login(body: LoginRequest, db=Depends(get_db)):
    try:
        user = (await db.execute(
            text("SELECT * FROM users WHERE email=:email"),
            {"email": body.email.lower().strip()}
        )).fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    # Support both is_active and status column schemas
    is_active = getattr(user, 'is_active', None)
    status    = getattr(user, 'status', None)
    if is_active is False or status in ('inactive', 'suspended', 'disabled'):
        raise HTTPException(status_code=401, detail="Cuenta desactivada")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    full_name = getattr(user, 'full_name', None) or user.email
    token = create_token({"sub": str(user.id), "email": user.email, "role": user.role, "name": full_name})
    return {"access_token": token, "token_type": "bearer", "user": {"id": str(user.id), "email": user.email, "full_name": full_name, "role": user.role}}

@router.post("/register-student")
async def register_student(body: RegisterRequest, db=Depends(get_db)):
    email = body.email.lower().strip()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="Email y contraseña requeridos")
    existing = (await db.execute(
        text("SELECT id FROM users WHERE email=:email"), {"email": email}
    )).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una cuenta con ese correo")
    hashed = _bcrypt.hashpw(body.password.encode(), _bcrypt.gensalt()).decode()
    full_name = body.full_name.strip() or email
    try:
        result = await db.execute(text("""
            INSERT INTO users (email, password_hash, full_name, role, status, plan_code)
            VALUES (:email, :hash, :full_name, 'student', 'active', 'pending')
            RETURNING id, email, full_name, role
        """), {"email": email, "hash": hashed, "full_name": full_name})
        await db.commit()
        user = result.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear cuenta: {str(e)}")
    token = create_token({"sub": str(user.id), "email": user.email, "role": user.role, "name": user.full_name})
    return {"access_token": token, "token_type": "bearer", "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role}}
