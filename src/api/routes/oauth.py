from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import text
import httpx, urllib.parse
from src.infrastructure.database import get_db
from src.infrastructure.config import settings
from src.api.routes.auth import create_token

router = APIRouter(prefix="/auth", tags=["OAuth"])

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_URL  = "https://www.googleapis.com/oauth2/v3/userinfo"

MS_AUTH_URL  = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MS_USER_URL  = "https://graph.microsoft.com/v1.0/me"

GOOGLE_CALLBACK = "https://ifces-production.up.railway.app/api/v1/auth/google/callback"
MS_CALLBACK     = "https://ifces-production.up.railway.app/api/v1/auth/microsoft/callback"

# ── Google ────────────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login():
    if not settings.google_client_id:
        raise HTTPException(400, "Google OAuth no configurado")
    params = urllib.parse.urlencode({
        "client_id":     settings.google_client_id,
        "redirect_uri":  GOOGLE_CALLBACK,
        "response_type": "code",
        "scope":         "openid email profile",
        "access_type":   "online",
    })
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}")

@router.get("/google/callback")
async def google_callback(code: str, db=Depends(get_db)):
    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code":          code,
            "client_id":     settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri":  GOOGLE_CALLBACK,
            "grant_type":    "authorization_code",
        })
        access_token = token_res.json().get("access_token")
        user_res = await client.get(GOOGLE_USER_URL,
                                    headers={"Authorization": f"Bearer {access_token}"})
        info = user_res.json()

    email     = info.get("email", "").lower()
    full_name = info.get("name") or email
    return await _upsert_oauth_user(email, full_name, "google", db)

# ── Microsoft ─────────────────────────────────────────────────────────────────

@router.get("/microsoft")
async def microsoft_login():
    if not settings.microsoft_client_id:
        raise HTTPException(400, "Microsoft OAuth no configurado")
    params = urllib.parse.urlencode({
        "client_id":     settings.microsoft_client_id,
        "redirect_uri":  MS_CALLBACK,
        "response_type": "code",
        "scope":         "openid email profile User.Read",
    })
    return RedirectResponse(f"{MS_AUTH_URL}?{params}")

@router.get("/microsoft/callback")
async def microsoft_callback(code: str, db=Depends(get_db)):
    async with httpx.AsyncClient() as client:
        token_res = await client.post(MS_TOKEN_URL, data={
            "code":          code,
            "client_id":     settings.microsoft_client_id,
            "client_secret": settings.microsoft_client_secret,
            "redirect_uri":  MS_CALLBACK,
            "grant_type":    "authorization_code",
            "scope":         "openid email profile User.Read",
        })
        access_token = token_res.json().get("access_token")
        user_res = await client.get(MS_USER_URL,
                                    headers={"Authorization": f"Bearer {access_token}"})
        info = user_res.json()

    email     = (info.get("mail") or info.get("userPrincipalName") or "").lower()
    full_name = info.get("displayName") or email
    return await _upsert_oauth_user(email, full_name, "microsoft", db)

# ── Shared ────────────────────────────────────────────────────────────────────

async def _upsert_oauth_user(email: str, full_name: str, provider: str, db):
    if not email:
        return RedirectResponse(f"{settings.frontend_url}?error=no_email")

    await db.execute(text("""
        INSERT INTO users (email, password_hash, full_name, role, status)
        VALUES (:email, '', :full_name, 'student', 'active')
        ON CONFLICT (email) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            status    = 'active'
    """), {"email": email, "full_name": full_name})
    await db.commit()

    user = (await db.execute(
        text("SELECT * FROM users WHERE email=:email"), {"email": email}
    )).fetchone()

    import json
    token     = create_token({"sub": str(user.id), "email": user.email,
                               "role": user.role, "name": full_name})
    user_json = urllib.parse.quote(json.dumps({
        "id": str(user.id), "email": user.email,
        "full_name": full_name, "role": user.role
    }))
    return RedirectResponse(f"{settings.frontend_url}?token={token}&user={user_json}")
