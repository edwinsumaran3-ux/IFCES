-- =============================================================================
--  migration_exams.sql  — Tablas que faltan para conectar el simulacro real
--  Ejecutar en PostgreSQL: psql -d icfes_db -f migration_exams.sql
-- =============================================================================

-- Tabla de intentos de examen
CREATE TABLE IF NOT EXISTS exam_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          VARCHAR(100) NOT NULL,
    student_gender      VARCHAR(20)  DEFAULT 'neutral',
    status              VARCHAR(20)  DEFAULT 'in_progress',   -- in_progress | finished
    remaining_ai_helps  INTEGER      DEFAULT 5,
    score_weighted      NUMERIC(6,2) DEFAULT 0.0,
    created_at          TIMESTAMPTZ  DEFAULT NOW(),
    finished_at         TIMESTAMPTZ
);

-- Tabla que asocia preguntas a un intento (las 245 seleccionadas)
CREATE TABLE IF NOT EXISTS exam_attempt_questions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id  UUID NOT NULL REFERENCES exam_attempts(id),
    pregunta_id INTEGER NOT NULL REFERENCES preguntas_icfes(id),
    orden       INTEGER NOT NULL,
    answered    BOOLEAN DEFAULT false,
    locked      BOOLEAN DEFAULT false,   -- true cuando se usó ayuda IA
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de respuestas del estudiante
CREATE TABLE IF NOT EXISTS student_answers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id       UUID NOT NULL REFERENCES exam_attempts(id),
    question_id      INTEGER NOT NULL REFERENCES preguntas_icfes(id),
    selected_option  CHAR(1),
    is_correct       BOOLEAN DEFAULT false,
    answered_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (attempt_id, question_id)
);

-- Tabla de sesiones de ayuda IA
CREATE TABLE IF NOT EXISTS ai_help_sessions (
    id                   UUID PRIMARY KEY,
    attempt_id           UUID NOT NULL REFERENCES exam_attempts(id),
    question_id          INTEGER NOT NULL REFERENCES preguntas_icfes(id),
    help_number          INTEGER,
    prompt_version       VARCHAR(100),
    whiteboard_json      TEXT,
    audio_script         TEXT,
    mirror_question_json TEXT,
    approved             BOOLEAN DEFAULT true,
    risk_level           VARCHAR(20) DEFAULT 'low',
    latency_ms           INTEGER,
    mirror_answer        CHAR(1),
    mirror_correct       BOOLEAN,
    awarded_score        NUMERIC(6,2) DEFAULT 0.0,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_attempts_student  ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_aq_attempt        ON exam_attempt_questions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_attempt   ON student_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_help_attempt      ON ai_help_sessions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_preguntas_area    ON preguntas_icfes(area);
