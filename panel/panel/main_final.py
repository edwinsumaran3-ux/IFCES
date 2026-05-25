# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes.auth    import router as auth_router
from src.api.routes.admin   import router as admin_router
from src.api.routes.exams   import router as exams_router
from src.api.routes.ai_help import router as ai_help_router
from src.api.routes.teacher import router as teacher_router

app = FastAPI(title="ERP ICFES Neuro-IA", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,    prefix="/api/v1")
app.include_router(admin_router,   prefix="/api/v1")
app.include_router(exams_router,   prefix="/api/v1")
app.include_router(ai_help_router, prefix="/api/v1")
app.include_router(teacher_router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status":"ok","system":"ERP ICFES Neuro-IA","version":"4.0.0"}
