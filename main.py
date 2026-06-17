# main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os
from src.api.routes.auth             import router as auth_router
from src.api.routes.admin            import router as admin_router
from src.api.routes.exams            import router as exams_router
from src.api.routes.ai_help          import router as ai_help_router
from src.api.routes.teacher          import router as teacher_router
from src.api.routes.oauth            import router as oauth_router
from src.api.routes.banco_preguntas  import router as banco_router
from src.api.routes.peru_auth        import router as peru_auth_router
from src.api.routes.peru_exams       import router as peru_exams_router
from src.api.routes.peru_banco       import router as peru_banco_router
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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"},
    )

app.include_router(auth_router,       prefix="/api/v1")
app.include_router(admin_router,      prefix="/api/v1")
app.include_router(exams_router,      prefix="/api/v1")
app.include_router(ai_help_router,    prefix="/api/v1")
app.include_router(teacher_router,    prefix="/api/v1")
app.include_router(oauth_router,      prefix="/api/v1")
app.include_router(banco_router,      prefix="/api/v1")
app.include_router(peru_auth_router,  prefix="/api/v1")
app.include_router(peru_exams_router, prefix="/api/v1")
app.include_router(peru_banco_router, prefix="/api/v1")

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
        # Add missing columns — each wrapped individually so one failure doesn't crash startup
        for col_sql in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name  VARCHAR(120)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS status     VARCHAR(20) DEFAULT 'active'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone      VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_code  VARCHAR(20) DEFAULT 'basic'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT true",
        ]:
            try:
                await conn.execute(text(col_sql))
            except Exception:
                pass
        # Drop NOT NULL on tenant_id only if the column actually exists
        try:
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='users' AND column_name='tenant_id'
                    ) THEN
                        ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;
                    END IF;
                END$$;
            """))
        except Exception:
            pass
        # Seed admin users
        for seed in [
            ('admin@icfes.edu.co',      '$2b$12$Gz.y8gA0X6.VfyDAcA4sLOchxU5Od5EcWcETUaqQFIEC.T4FHYSqC', 'Administrador General', 'admin'),
            ('edwinsumaran3@gmail.com', '$2b$12$Gz.y8gA0X6.VfyDAcA4sLOchxU5Od5EcWcETUaqQFIEC.T4FHYSqC', 'Edwin Sumaran',         'admin'),
        ]:
            await conn.execute(text("""
                INSERT INTO users (email, password_hash, full_name, role, status, plan_code, is_active)
                VALUES (:email, :hash, :name, :role, 'active', 'premium', true)
                ON CONFLICT (email) DO UPDATE SET
                    password_hash = :hash,
                    full_name     = :name,
                    role          = :role,
                    status        = 'active',
                    plan_code     = 'premium',
                    is_active     = true
            """), {"email": seed[0], "hash": seed[1], "name": seed[2], "role": seed[3]})
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name                      VARCHAR(50) NOT NULL,
                code                      VARCHAR(30) UNIQUE NOT NULL,
                price_institution_cop     INTEGER NOT NULL DEFAULT 0,
                price_student_cop         INTEGER NOT NULL DEFAULT 0,
                max_ai_helps              INTEGER NOT NULL DEFAULT 1,
                difficulty_levels         TEXT[] NOT NULL DEFAULT ARRAY['MEDIA'],
                includes_whatsapp         BOOLEAN DEFAULT FALSE,
                includes_advanced_reports BOOLEAN DEFAULT FALSE,
                status                    VARCHAR(20) DEFAULT 'active',
                created_at                TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        for col_sql in [
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_institution_cop     INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_student_cop         INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS difficulty_levels         TEXT[] NOT NULL DEFAULT ARRAY['MEDIA']",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS includes_whatsapp         BOOLEAN DEFAULT FALSE",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS includes_advanced_reports BOOLEAN DEFAULT FALSE",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_ai_helps              INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS status                    VARCHAR(20) DEFAULT 'active'",
            "ALTER TABLE subscription_plans ALTER COLUMN price_institution_cop     SET DEFAULT 0",
            "ALTER TABLE subscription_plans ALTER COLUMN price_student_cop         SET DEFAULT 0",
            "ALTER TABLE subscription_plans ALTER COLUMN difficulty_levels         SET DEFAULT ARRAY['MEDIA']",
            "ALTER TABLE subscription_plans ALTER COLUMN max_ai_helps              SET DEFAULT 1",
        ]:
            try:
                await conn.execute(text(col_sql))
            except Exception:
                pass
        await conn.execute(text("""
            INSERT INTO subscription_plans
                (name, code, price_institution_cop, price_student_cop, max_ai_helps, difficulty_levels, includes_whatsapp, includes_advanced_reports)
            VALUES
                ('Basico',  'basic',    6000,  8000, 1, ARRAY['MEDIA'],                 false, false),
                ('Plus',    'plus',     8000, 12000, 3, ARRAY['MEDIA','ALTA'],           false, true),
                ('Premium', 'premium', 12000, 15000, 5, ARRAY['MEDIA','ALTA','RETO'],   true,  true)
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
                nequi_ref   VARCHAR(100) UNIQUE,
                status      VARCHAR(20) DEFAULT 'pending',
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        # Ensure unique index exists even if table was created before without it
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS payments_nequi_ref_idx
            ON payments (nequi_ref)
            WHERE nequi_ref IS NOT NULL
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
        # Columna tema en preguntas (para banco de preguntas por tema)
        try:
            await conn.execute(text(
                "ALTER TABLE preguntas_icfes ADD COLUMN IF NOT EXISTS tema VARCHAR(60)"
            ))
        except Exception:
            pass
        # Índice para búsquedas por area+tema
        try:
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_preguntas_area_tema ON preguntas_icfes (area, tema)"
            ))
        except Exception:
            pass
        # Progreso del estudiante en el banco
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS banco_progress (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id  UUID NOT NULL,
                question_id UUID NOT NULL,
                viewed      BOOLEAN DEFAULT true,
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (student_id, question_id)
            )
        """))

        # ── PERU tables ──────────────────────────────────────────────────────────
        # Add country column to users (for multi-country support)
        try:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(5) DEFAULT 'CO'"
            ))
        except Exception:
            pass

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS peru_preguntas (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                seccion     VARCHAR(5)  NOT NULL,      -- A | B | C | D
                materia     VARCHAR(80) NOT NULL,
                enunciado   TEXT        NOT NULL,
                opcion_a    TEXT,
                opcion_b    TEXT,
                opcion_c    TEXT,
                opcion_d    TEXT,
                respuesta   VARCHAR(2)  NOT NULL,
                explicacion TEXT,
                dificultad  VARCHAR(20) DEFAULT 'MEDIA',
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        try:
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_peru_preguntas_seccion ON peru_preguntas (seccion)"
            ))
        except Exception:
            pass

        # ── Load real Peru questions from JSON (UNT exam) ────────────────────
        import json as _json, os as _os
        _json_path = _os.path.join(_os.path.dirname(__file__), "PERU", "preguntas_unt.json")
        if _os.path.exists(_json_path):
            # Reload if table is empty OR if old data has no explanations (corrupted parse)
            _need_reload = False
            try:
                _row = (await conn.execute(text("SELECT COUNT(*) AS n FROM peru_preguntas"))).fetchone()
                _count = _row.n if _row else 0
                if _count == 0:
                    _need_reload = True
                else:
                    # Check if we have questions with explanations (new good data)
                    _expl_row = (await conn.execute(text(
                        "SELECT COUNT(*) AS n FROM peru_preguntas WHERE explicacion != '' AND LENGTH(explicacion) > 50"
                    ))).fetchone()
                    _expl_count = _expl_row.n if _expl_row else 0
                    # Reload if materias are wrong or explanations are missing (< 95% coverage)
                    if _expl_count < max(10, int(_count * 0.95)):
                        await conn.execute(text("TRUNCATE TABLE peru_preguntas RESTART IDENTITY CASCADE"))
                        print(f"[startup] Reloading Peru questions ({_expl_count}/{_count} had explanations)")
                        _need_reload = True
            except Exception:
                _need_reload = True
            if _need_reload:
                with open(_json_path, encoding='utf-8') as _f:
                    _pregs = _json.load(_f)
                _ins = 0
                for _q in _pregs:
                    try:
                        await conn.execute(text("""
                            INSERT INTO peru_preguntas
                                (seccion, materia, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta, explicacion)
                            VALUES (:sec,:mat,:enun,:a,:b,:c,:d,:resp,:expl)
                            ON CONFLICT DO NOTHING
                        """), {"sec": _q.get("seccion","A"), "mat": _q.get("materia","General"),
                               "enun": _q.get("enunciado",""), "a": _q.get("opcion_a",""),
                               "b": _q.get("opcion_b",""), "c": _q.get("opcion_c",""),
                               "d": _q.get("opcion_d",""), "resp": _q.get("respuesta","A"),
                               "expl": _q.get("explicacion","")})
                        _ins += 1
                    except Exception:
                        pass
                print(f"[startup] Peru questions loaded: {_ins}")

        # ── Demo questions (backup if no JSON) ───────────────────────────────
        demo_preguntas = [
            # ── SECCIÓN A ─────────────────────────────────────────────────────
            ('A','Lenguaje','Lee el siguiente texto y responde: "El sol se ocultó tras las montañas andinas, tiñendo el cielo de rojo y naranja." ¿Qué figura literaria predomina en este texto?','Metáfora','Símil','Hipérbole','Imagen sensorial','D','La frase evoca una imagen visual del atardecer andino mediante una descripción sensorial directa.'),
            ('A','Lenguaje','¿Cuál de las siguientes oraciones tiene un sujeto compuesto?','El niño juega en el parque.','María y José estudian juntos.','El perro ladra fuerte.','La lluvia cae sobre la ciudad.','B','Sujeto compuesto: dos o más núcleos en el sujeto. "María y José" son dos núcleos.'),
            ('A','Literatura','¿Quién escribió "El Señor Presidente", novela que denuncia la dictadura?','Pablo Neruda','Gabriel García Márquez','Miguel Ángel Asturias','Julio Cortázar','C','Miguel Ángel Asturias, guatemalteco, Premio Nobel 1967, escribió "El Señor Presidente".'),
            ('A','Historia del Perú','¿En qué año se proclamó la independencia del Perú?','1810','1821','1824','1826','B','José de San Martín proclamó la independencia del Perú el 28 de julio de 1821 en Lima.'),
            ('A','Historia del Perú','¿Cuál fue la última gran batalla que consolidó la independencia sudamericana?','Batalla de Junín','Batalla de Ayacucho','Batalla de Boyacá','Batalla de Chacabuco','B','La Batalla de Ayacucho (1824) fue la batalla decisiva que puso fin al dominio español en Sudamérica.'),
            ('A','Geografía','¿Cuál es la capital del Perú?','Cusco','Arequipa','Lima','Trujillo','C','Lima es la capital y ciudad más poblada de la República del Perú.'),
            ('A','Filosofía','¿Quién formuló el imperativo categórico como principio ético universal?','Aristóteles','René Descartes','Immanuel Kant','John Locke','C','Immanuel Kant formuló el imperativo categórico: actúa solo según aquella máxima que puedas querer que sea ley universal.'),
            # ── SECCIÓN B ─────────────────────────────────────────────────────
            ('B','Matemática','Si f(x) = 2x² − 3x + 1, ¿cuánto vale f(2)?','1','3','5','7','B','f(2) = 2(4) − 3(2) + 1 = 8 − 6 + 1 = 3'),
            ('B','Matemática','¿Cuál es el valor de log₂(64)?','4','5','6','7','C','2⁶ = 64, por lo tanto log₂(64) = 6'),
            ('B','Física','Un objeto cae libremente desde el reposo. ¿Qué velocidad tiene después de 3 segundos? (g = 10 m/s²)','15 m/s','20 m/s','30 m/s','10 m/s','C','v = g·t = 10 × 3 = 30 m/s'),
            ('B','Física','La Segunda Ley de Newton establece que la fuerza neta es igual a:','masa × velocidad','masa × aceleración','peso × tiempo','volumen × densidad','B','F = m·a (Fuerza = masa × aceleración), Segunda Ley de Newton.'),
            ('B','Química','¿Cuál es el número atómico del oxígeno?','6','7','8','9','C','El oxígeno (O) tiene número atómico 8, con 8 protones en su núcleo.'),
            ('B','Química','¿Qué tipo de enlace se forma entre el sodio y el cloro en el NaCl?','Covalente polar','Covalente apolar','Iónico','Metálico','C','El NaCl se forma por un enlace iónico: Na cede un electrón al Cl.'),
            ('B','Biología','¿Cuál es la función principal de las mitocondrias?','Síntesis de proteínas','Producción de energía (ATP)','Digestión celular','Transporte de sustancias','B','Las mitocondrias producen ATP mediante la respiración celular aeróbica.'),
            # ── SECCIÓN C ─────────────────────────────────────────────────────
            ('C','Razonamiento Verbal','Complete la analogía: LIBRO : BIBLIOTECA :: CUADRO :','Museo','Galería','Arte','Pintor','B','Así como los libros se guardan en bibliotecas, los cuadros se exhiben en galerías.'),
            ('C','Razonamiento Verbal','¿Cuál es el sinónimo de EFÍMERO?','Eterno','Transitorio','Profundo','Estable','B','Efímero = que dura poco tiempo = transitorio.'),
            ('C','Razonamiento Matemático','Si el 30% de un número es 45, ¿cuál es el número?','100','135','150','180','C','x × 0.30 = 45 → x = 45/0.30 = 150'),
            ('C','Razonamiento Matemático','¿Cuántos triángulos hay en una figura donde se trazan 3 diagonales en un hexágono regular?','6','8','12','24','A','Al trazar las diagonales principales de un hexágono regular se forman 6 triángulos equiláteros.'),
            # ── SECCIÓN D ─────────────────────────────────────────────────────
            ('D','Aptitud Académica','Un tren recorre 360 km en 3 horas. ¿A qué velocidad viaja?','100 km/h','110 km/h','120 km/h','130 km/h','C','v = d/t = 360/3 = 120 km/h'),
            ('D','Aptitud Académica','Si Juan tiene 5 veces la edad de Ana, y entre los dos suman 24 años, ¿cuántos años tiene Juan?','15','18','20','25','C','J + A = 24 y J = 5A → 6A = 24 → A = 4 → J = 20'),
            ('D','Comprensión de Textos','¿Cuál es el propósito principal de un texto argumentativo?','Narrar una historia','Describir un lugar','Convencer al lector','Dar instrucciones','C','El texto argumentativo busca persuadir o convencer al lector mediante razones y evidencias.'),
            ('D','Comprensión de Textos','¿Qué elemento NO pertenece a la estructura de un ensayo?','Introducción','Desarrollo','Personajes','Conclusión','C','Los personajes son propios de textos narrativos, no de ensayos académicos.'),
        ]
        # Only insert demo questions if JSON didn't load (no real questions)
        try:
            _real_count = (await conn.execute(text("SELECT COUNT(*) FROM peru_preguntas"))).scalar_one()
        except Exception:
            _real_count = 0
        if _real_count == 0:
            for (sec, mat, enun, a, b, c, d, resp, expl) in demo_preguntas:
                try:
                    await conn.execute(text("""
                        INSERT INTO peru_preguntas (seccion, materia, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta, explicacion)
                        VALUES (:sec, :mat, :enun, :a, :b, :c, :d, :resp, :expl)
                        ON CONFLICT DO NOTHING
                    """), {"sec":sec,"mat":mat,"enun":enun,"a":a,"b":b,"c":c,"d":d,"resp":resp,"expl":expl})
                except Exception:
                    pass

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS peru_intentos (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id       TEXT        NOT NULL,
                seccion          VARCHAR(10) NOT NULL,
                status           VARCHAR(20) DEFAULT 'in_progress',
                total_questions  INTEGER     DEFAULT 0,
                score_pct        FLOAT       DEFAULT 0.0,
                created_at       TIMESTAMPTZ DEFAULT NOW(),
                finished_at      TIMESTAMPTZ
            )
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_help_sessions (
                id                   UUID PRIMARY KEY,
                attempt_id           UUID NOT NULL,
                question_id          UUID,
                help_number          INTEGER DEFAULT 1,
                prompt_version       VARCHAR(50),
                whiteboard_json      TEXT,
                audio_script         TEXT,
                mirror_question_json TEXT,
                mirror_answer        VARCHAR(2),
                mirror_correct       BOOLEAN,
                awarded_score        FLOAT DEFAULT 0.0,
                approved             BOOLEAN DEFAULT true,
                risk_level           VARCHAR(20),
                latency_ms           INTEGER,
                created_at           TIMESTAMPTZ DEFAULT NOW()
            )
        """))

@app.get("/health")
async def health():
    return {"status":"ok","system":"ERP ICFES Neuro-IA","version":"4.0.0"}

# ── Servir el frontend compilado ──────────────────────────────────────────────
_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_DIST, "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str = ""):
        # No interceptar rutas de API
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        index = os.path.join(_DIST, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return {"error": "Frontend no compilado"}
