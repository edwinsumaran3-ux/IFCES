-- =============================================================================
--  MIGRACIÓN COMPLETA — ERP ICFES Neuro-IA
--  Ejecutar en PostgreSQL una sola vez
-- =============================================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
--  TENANTS E INSTITUCIONES
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    nit         VARCHAR(20) UNIQUE,
    plan        VARCHAR(20) NOT NULL DEFAULT 'BASIC',
    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institutions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    dane_code   VARCHAR(20),
    city        TEXT,
    department  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
--  USUARIOS Y ROLES
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id),
    institution_id UUID REFERENCES institutions(id),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role          VARCHAR(30) NOT NULL DEFAULT 'STUDENT',
    gender        VARCHAR(10) NOT NULL DEFAULT 'neutral',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id),
    tenant_id     UUID NOT NULL,
    full_name     TEXT NOT NULL,
    grade         VARCHAR(10),
    group_name    VARCHAR(10),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
--  BANCO DE PREGUNTAS ICFES
-- =============================================================================
CREATE TABLE IF NOT EXISTS icfes_areas (
    id    SERIAL PRIMARY KEY,
    code  VARCHAR(40) UNIQUE NOT NULL,
    name  TEXT NOT NULL
);

INSERT INTO icfes_areas (code, name) VALUES
    ('mathematics',      'Matemáticas'),
    ('critical_reading', 'Lectura Crítica'),
    ('social_sciences',  'Ciencias Sociales'),
    ('natural_sciences', 'Ciencias Naturales'),
    ('english',          'Inglés')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS question_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    area            VARCHAR(40) NOT NULL,
    competency      VARCHAR(80),
    component       VARCHAR(80),
    evidence        TEXT,
    cognitive_op    VARCHAR(80),
    difficulty      VARCHAR(20) NOT NULL DEFAULT 'medium',
    difficulty_idx  NUMERIC(4,2),
    discrimination  NUMERIC(4,2),
    stem            TEXT NOT NULL,
    points          NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
    version         INTEGER NOT NULL DEFAULT 1,
    embedding       vector(1536),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES question_items(id) ON DELETE CASCADE,
    label       VARCHAR(2) NOT NULL,
    text        TEXT NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    distractor_type TEXT
);

-- =============================================================================
--  SIMULACROS
-- =============================================================================
CREATE TABLE IF NOT EXISTS exam_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    title           TEXT NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 45,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    max_ai_helps    INTEGER NOT NULL DEFAULT 5,
    mirror_score_factor NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    randomize       BOOLEAN NOT NULL DEFAULT TRUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_instances (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id  UUID NOT NULL REFERENCES exam_templates(id),
    tenant_id    UUID NOT NULL,
    title        TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_instance_id    UUID NOT NULL REFERENCES exam_instances(id),
    student_id          UUID NOT NULL REFERENCES students(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    remaining_ai_helps  INTEGER NOT NULL DEFAULT 5,
    score_raw           NUMERIC(6,2) NOT NULL DEFAULT 0,
    score_weighted      NUMERIC(6,2) NOT NULL DEFAULT 0,
    integrity_flags     JSONB NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      UUID NOT NULL REFERENCES exam_attempts(id),
    question_id     UUID NOT NULL REFERENCES question_items(id),
    selected_option VARCHAR(2),
    is_correct      BOOLEAN,
    points_awarded  NUMERIC(5,2) NOT NULL DEFAULT 0,
    time_spent_secs INTEGER,
    used_ai_help    BOOLEAN NOT NULL DEFAULT FALSE,
    answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
--  SESIONES DE AYUDA IA
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_help_sessions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id            UUID NOT NULL REFERENCES exam_attempts(id),
    question_id           UUID NOT NULL REFERENCES question_items(id),
    help_number           INTEGER NOT NULL,
    prompt_version        TEXT NOT NULL,
    whiteboard_json       JSONB,
    audio_script          TEXT,
    audio_mp3_url         TEXT,
    mirror_question_json  JSONB,
    mirror_answer         VARCHAR(2),
    mirror_correct        BOOLEAN,
    awarded_score         NUMERIC(5,2),
    approved              BOOLEAN NOT NULL DEFAULT TRUE,
    risk_level            VARCHAR(20) NOT NULL DEFAULT 'low',
    latency_ms            INTEGER,
    cost_usd              NUMERIC(8,6),
    model_used            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
--  PROMPT REGISTRY
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    version       TEXT NOT NULL,
    category      VARCHAR(40),
    content       TEXT NOT NULL,
    output_schema JSONB,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft',
    model_family  TEXT,
    created_by    UUID,
    approved_by   UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted_at   TIMESTAMPTZ,
    UNIQUE(name, version)
);

-- =============================================================================
--  AUDITORÍA
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    event_type    TEXT NOT NULL,
    student_id    UUID,
    attempt_id    UUID,
    question_id   UUID,
    payload       JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
--  ÍNDICES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_question_area      ON question_items(area);
CREATE INDEX IF NOT EXISTS idx_question_tenant    ON question_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student   ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_attempt ON ai_help_sessions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant       ON audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_student      ON audit_events(student_id);

SELECT 'Migración ERP ICFES Neuro-IA completada' AS status;
