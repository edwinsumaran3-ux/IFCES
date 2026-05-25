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
    user = (await db.execute(
        text("SELECT * FROM users WHERE email=:email AND is_active=true"),
        {"email": body.email.lower().strip()}
    )).fetchone()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token = create_token({"sub": str(user.id), "email": user.email, "role": user.role, "name": user.full_name or user.email})
    return {"access_token": token, "token_type": "bearer", "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name or user.email, "role": user.role}}
