# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes.auth    import router as auth_router
from src.api.routes.admin   import router as admin_router
from src.api.routes.exams   import router as exams_router
from src.api.routes.ai_help import router as ai_help_router
from src.api.routes.teacher import router as teacher_router
from src.api.routes.oauth   import router as oauth_router
from src.infrastructure.database import engine
from sqlalchemy import text

app = FastAPI(title="ERP ICFES Neuro-IA", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,    prefix="/api/v1")
app.include_router(admin_router,   prefix="/api/v1")
app.include_router(exams_router,   prefix="/api/v1")
app.include_router(ai_help_router, prefix="/api/v1")
app.include_router(teacher_router, prefix="/api/v1")
app.include_router(oauth_router,   prefix="/api/v1")

@app.on_event("startup")
async def run_migrations():
    async with engine.begin() as conn:
        # Create users table if not exists (new schema)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email           VARCHAR(120) NOT NULL UNIQUE,
                password_hash   TEXT,
                full_name       VARCHAR(120),
                role            VARCHAR(20) NOT NULL DEFAULT 'student',
                institution_id  UUID,
                phone           VARCHAR(20),
                status          VARCHAR(20) DEFAULT 'active',
                plan_code       VARCHAR(20) DEFAULT 'basic',
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        # Add missing columns if table already existed with old schema
        for col_sql in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name  VARCHAR(120)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS status     VARCHAR(20) DEFAULT 'active'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone      VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_code  VARCHAR(20) DEFAULT 'basic'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT true",
        ]:
            await conn.execute(text(col_sql))
        # Seed admin user (password: Admin1234)
        await conn.execute(text("""
            INSERT INTO users (email, password_hash, full_name, role, status)
            VALUES (
                'admin@icfes.edu.co',
                '$2b$12$eDhs1y/VtyS6zRW2H9AMpOakXor7eAXxWgu1arr3VwZHb2QhZikt.',
                'Administrador General',
                'admin',
                'active'
            ) ON CONFLICT (email) DO UPDATE SET
                password_hash = '$2b$12$eDhs1y/VtyS6zRW2H9AMpOakXor7eAXxWgu1arr3VwZHb2QhZikt.',
                full_name = 'Administrador General',
                role = 'admin',
                status = 'active'
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(50) NOT NULL,
                code VARCHAR(30) UNIQUE NOT NULL,
                price_cop INTEGER NOT NULL DEFAULT 0,
                max_ai_helps INTEGER NOT NULL DEFAULT 1,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            INSERT INTO subscription_plans (name, code, price_cop, max_ai_helps)
            VALUES
                ('Basico',  'basic',   6000, 1),
                ('Plus',    'plus',    8000, 3),
                ('Premium', 'premium', 12000, 5)
            ON CONFLICT (code) DO NOTHING
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS exam_attempts (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id          UUID NOT NULL,
                student_gender      VARCHAR(10) DEFAULT 'neutral',
                status              VARCHAR(20) DEFAULT 'in_progress',
                remaining_ai_helps  INTEGER DEFAULT 1,
                score_weighted      FLOAT DEFAULT 0.0,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                finished_at         TIMESTAMPTZ
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS exam_attempt_questions (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                attempt_id  UUID NOT NULL,
                pregunta_id UUID NOT NULL,
                orden       INTEGER,
                answered    BOOLEAN DEFAULT false,
                locked      BOOLEAN DEFAULT false
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS student_answers (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                attempt_id      UUID NOT NULL,
                question_id     UUID NOT NULL,
                selected_option VARCHAR(2),
                is_correct      BOOLEAN DEFAULT false,
                answered_at     TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (attempt_id, question_id)
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS payments (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     UUID NOT NULL,
                plan_code   VARCHAR(30) NOT NULL,
                amount_cop  INTEGER NOT NULL DEFAULT 0,
                nequi_ref   VARCHAR(100),
                status      VARCHAR(20) DEFAULT 'pending',
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS preguntas_icfes (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                codigo      VARCHAR(30),
                area        VARCHAR(80) NOT NULL,
                enunciado   TEXT NOT NULL,
                opcion_a    TEXT,
                opcion_b    TEXT,
                opcion_c    TEXT,
                opcion_d    TEXT,
                respuesta   VARCHAR(2) NOT NULL,
                explicacion TEXT,
                dificultad  VARCHAR(20) DEFAULT 'MEDIA',
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """))

@app.get("/health")
async def health():
    return {"status":"ok","system":"ERP ICFES Neuro-IA","version":"4.0.0"}
