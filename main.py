# =============================================================================
#  main.py  — FastAPI app principal
#
#  Arrancar: uvicorn main:app --reload
# =============================================================================
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes.ai_help import router as ai_help_router

app = FastAPI(
    title="ERP ICFES Neuro-IA",
    description="Motor socrático bimodal con Claude + Google TTS",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_help_router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status":"ok","system":"ERP ICFES Neuro-IA","version":"4.0.0"}
