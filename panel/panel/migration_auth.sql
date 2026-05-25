-- migration_auth.sql
-- Ejecutar: psql -U postgres -d icfes_db -f migration_auth.sql

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(120) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('admin','institution','teacher','student')),
    institution_id  UUID,
    phone           VARCHAR(20),
    status          VARCHAR(20) DEFAULT 'active',
    plan_code       VARCHAR(20) DEFAULT 'basic',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL,
    price_institution_cop INTEGER NOT NULL,
    price_student_cop INTEGER NOT NULL,
    max_ai_helps INTEGER NOT NULL,
    difficulty_levels TEXT[] NOT NULL,
    includes_whatsapp BOOLEAN DEFAULT FALSE,
    includes_advanced_reports BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_plans
(name, code, price_institution_cop, price_student_cop, max_ai_helps, difficulty_levels, includes_whatsapp, includes_advanced_reports)
VALUES
('Basico',  'basic',   6000,  8000, 1, ARRAY['MEDIA'],            false, false),
('Plus',    'plus',    8000, 12000, 3, ARRAY['MEDIA','ALTA'],      false, true),
('Premium', 'premium', 12000,15000, 5, ARRAY['MEDIA','ALTA','RETO'], true, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (id, email, password_hash, full_name, role, status)
VALUES (
    gen_random_uuid(),
    'admin@icfes.edu.co',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGNwNmFOqBqGcbMETZkJqTqrUTe',
    'Administrador General',
    'admin',
    'active'
) ON CONFLICT (email) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);
