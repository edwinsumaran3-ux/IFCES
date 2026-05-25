# src/api/routes/auth.py
from __future__ import annotations
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from passlib.context import CryptContext
from jose import jwt
from src.infrastructure.database import get_db
from src.infrastructure.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET = "icfes-neuro-ia-secret-2026"
ALGORITHM = "HS256"

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

def create_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(to_encode, SECRET, algorithm=ALGORITHM)

@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db=Depends(get_db)):
    user = (await db.execute(
        text("SELECT * FROM users WHERE email=:email AND role=:role AND status='active'"),
        {"email": body.email.lower().strip(), "role": body.role}
    )).fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if not pwd_context.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
    })

    return LoginResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        }
    )

@router.post("/register-student")
async def register_student(body: dict, db=Depends(get_db)):
    existing = (await db.execute(
        text("SELECT id FROM users WHERE email=:email"),
        {"email": body["email"].lower().strip()}
    )).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya esta registrado")

    from uuid import uuid4
    user_id = str(uuid4())
    hashed = pwd_context.hash(body["password"])

    await db.execute(
        text("""
            INSERT INTO users (id, email, password_hash, full_name, role, status, created_at)
            VALUES (:id, :email, :hash, :name, 'student', 'active', NOW())
        """),
        {"id": user_id, "email": body["email"].lower().strip(),
         "hash": hashed, "name": body["full_name"]}
    )
    await db.commit()

    token = create_token({"sub": user_id, "email": body["email"], "role": "student", "name": body["full_name"]})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user_id, "email": body["email"], "full_name": body["full_name"], "role": "student"}}
