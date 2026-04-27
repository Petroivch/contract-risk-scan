-- Contract Risk Scanner
-- Schema snapshot after migrations v1..v4.
-- Source of truth for deployment:
--   db/migrations/v1__init_schema.sql
--   db/migrations/v2__optimization_and_guards.sql
--   db/migrations/v3__language_support.sql
--   db/migrations/v4__config_registry_and_invariants.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9._-]+$'),
    value_json JSONB NOT NULL,
    value_type VARCHAR(16) NOT NULL CHECK (value_type IN ('string', 'integer', 'boolean', 'array', 'object')),
    scope VARCHAR(32) NOT NULL CHECK (scope IN ('global', 'mobile', 'server', 'db', 'build')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_config_value_type_chk CHECK (
        (value_type = 'string'  AND jsonb_typeof(value_json) = 'string') OR
        (value_type = 'integer' AND jsonb_typeof(value_json) = 'number') OR
        (value_type = 'boolean' AND jsonb_typeof(value_json) = 'boolean') OR
        (value_type = 'array'   AND jsonb_typeof(value_json) = 'array') OR
        (value_type = 'object'  AND jsonb_typeof(value_json) = 'object')
    )
);

CREATE TABLE IF NOT EXISTS language_catalog (
    code VARCHAR(2) PRIMARY KEY CHECK (code ~ '^[a-z]{2}$'),
    display_name VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_language_catalog_single_default
ON language_catalog (is_default)
WHERE is_default = TRUE;

CREATE OR REPLACE FUNCTION get_default_language_code()
RETURNS VARCHAR(2) AS $$
DECLARE
    default_code VARCHAR(2);
BEGIN
    SELECT code INTO default_code
    FROM language_catalog
    WHERE is_default = TRUE AND is_active = TRUE
    ORDER BY code
    LIMIT 1;

    IF default_code IS NULL THEN
        SELECT code INTO default_code
        FROM language_catalog
        WHERE is_active = TRUE
        ORDER BY code
        LIMIT 1;
    END IF;

    IF default_code IS NULL THEN
        RAISE EXCEPTION 'language_catalog has no active languages';
    END IF;

    RETURN default_code;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_config_string(cfg_key TEXT)
RETURNS TEXT AS $$
DECLARE
    configured_value TEXT;
BEGIN
    SELECT trim(both '"' FROM value_json::text)
    INTO configured_value
    FROM app_config
    WHERE key = cfg_key
      AND value_type = 'string'
    LIMIT 1;

    IF configured_value IS NULL OR btrim(configured_value) = '' THEN
        RAISE EXCEPTION 'Missing string config key: %', cfg_key;
    END IF;

    RETURN configured_value;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_config_integer(cfg_key TEXT)
RETURNS INTEGER AS $$
DECLARE
    configured_value INTEGER;
BEGIN
    SELECT (value_json::text)::INTEGER
    INTO configured_value
    FROM app_config
    WHERE key = cfg_key
      AND value_type = 'integer'
    LIMIT 1;

    IF configured_value IS NULL THEN
        RAISE EXCEPTION 'Missing integer config key: %', cfg_key;
    END IF;

    RETURN configured_value;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION set_default_language_code(target_code TEXT)
RETURNS VOID AS $$
DECLARE
    normalized_target VARCHAR(2);
BEGIN
    SELECT code
    INTO normalized_target
    FROM language_catalog
    WHERE code = lower(btrim(target_code))
      AND is_active = TRUE
    LIMIT 1;

    IF normalized_target IS NULL THEN
        RAISE EXCEPTION 'Cannot set default language to inactive or missing code: %', target_code;
    END IF;

    UPDATE language_catalog
    SET is_default = FALSE
    WHERE is_default = TRUE
      AND code <> normalized_target;

    UPDATE language_catalog
    SET is_default = TRUE
    WHERE code = normalized_target
      AND is_default = FALSE;

    UPDATE language_catalog
    SET is_default = FALSE
    WHERE is_default = TRUE
      AND is_active = FALSE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_supported_language(input_lang TEXT)
RETURNS VARCHAR(2) AS $$
DECLARE
    normalized_code VARCHAR(2);
BEGIN
    IF input_lang IS NULL OR btrim(input_lang) = '' THEN
        RETURN get_default_language_code();
    END IF;

    input_lang := lower(btrim(input_lang));

    SELECT code INTO normalized_code
    FROM language_catalog
    WHERE code = input_lang AND is_active = TRUE
    LIMIT 1;

    RETURN COALESCE(normalized_code, get_default_language_code());
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    full_name VARCHAR(255),
    preferred_language VARCHAR(2) NOT NULL DEFAULT get_default_language_code() REFERENCES language_catalog(code),
    locale VARCHAR(16) NOT NULL DEFAULT get_config_string('locale.default') CHECK (locale ~ '^[a-z]{2}-[A-Z]{2}$'),
    timezone VARCHAR(64) NOT NULL DEFAULT get_config_string('timezone.default') CHECK (btrim(timezone) <> ''),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'pending')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_name VARCHAR(80) NOT NULL,
    normalized_role VARCHAR(32) NOT NULL CHECK (normalized_role IN ('executor', 'employer', 'custom')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role_name)
);

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_profile_id UUID REFERENCES role_profiles(id) ON DELETE SET NULL,
    original_filename TEXT NOT NULL,
    file_storage_key TEXT NOT NULL UNIQUE,
    file_sha256 CHAR(64) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    language_code VARCHAR(2) NOT NULL DEFAULT get_default_language_code() REFERENCES language_catalog(code),
    status VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'failed', 'archived')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    selected_role_label VARCHAR(80) NOT NULL,
    selected_role_kind VARCHAR(32) NOT NULL CHECK (selected_role_kind IN ('executor', 'employer', 'custom')),
    report_language VARCHAR(2) NOT NULL DEFAULT get_default_language_code() REFERENCES language_catalog(code),
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'canceled')),
    priority SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 9),
    model_name VARCHAR(120),
    ocr_engine VARCHAR(120),
    idempotency_key VARCHAR(100) UNIQUE,
    error_code VARCHAR(64),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    clause_reference VARCHAR(128),
    clause_text TEXT,
    role_impact VARCHAR(16) NOT NULL CHECK (role_impact IN ('executor', 'employer', 'both', 'neutral')),
    score NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
    recommendation TEXT,
    source_confidence NUMERIC(4,3) CHECK (source_confidence BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disputed_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    clause_reference VARCHAR(128),
    clause_text TEXT NOT NULL,
    dispute_reason TEXT NOT NULL,
    risk_level VARCHAR(16) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    role_impact VARCHAR(16) NOT NULL CHECK (role_impact IN ('executor', 'employer', 'both', 'neutral')),
    suggested_rewrite TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_job_id UUID NOT NULL UNIQUE REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    summary_short TEXT NOT NULL,
    obligations_user TEXT NOT NULL,
    obligations_counterparty TEXT NOT NULL,
    key_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
    role_focus VARCHAR(16) NOT NULL CHECK (role_focus IN ('executor', 'employer', 'both', 'neutral')),
    report_language VARCHAR(2) NOT NULL DEFAULT get_default_language_code() REFERENCES language_catalog(code),
    confidence NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    analysis_job_id UUID REFERENCES analysis_jobs(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_app_config_updated_at
BEFORE UPDATE ON app_config
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_language_catalog_updated_at
BEFORE UPDATE ON language_catalog
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_role_profiles_updated_at
BEFORE UPDATE ON role_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contracts_updated_at
BEFORE UPDATE ON contracts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_analysis_jobs_updated_at
BEFORE UPDATE ON analysis_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_risk_items_updated_at
BEFORE UPDATE ON risk_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_disputed_clauses_updated_at
BEFORE UPDATE ON disputed_clauses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_summaries_updated_at
BEFORE UPDATE ON summaries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION normalize_supported_language(input_lang TEXT)
RETURNS VARCHAR(2) AS
DECLARE
    normalized_code VARCHAR(2);
BEGIN
    IF input_lang IS NULL OR btrim(input_lang) = '' THEN
        RETURN get_default_language_code();
    END IF;

    input_lang := lower(btrim(input_lang));

    SELECT code INTO normalized_code
    FROM language_catalog
    WHERE code = input_lang AND is_active = TRUE
    LIMIT 1;

    RETURN COALESCE(normalized_code, get_default_language_code());
END;
 LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION trg_users_normalize_language()
RETURNS TRIGGER AS
BEGIN
    NEW.preferred_language := normalize_supported_language(NEW.preferred_language);
    RETURN NEW;
END;
 LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_contracts_normalize_language()
RETURNS TRIGGER AS
BEGIN
    NEW.language_code := normalize_supported_language(NEW.language_code);
    RETURN NEW;
END;
 LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_analysis_jobs_normalize_language()
RETURNS TRIGGER AS
BEGIN
    NEW.report_language := normalize_supported_language(NEW.report_language);
    RETURN NEW;
END;
 LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_summaries_normalize_language()
RETURNS TRIGGER AS
BEGIN
    NEW.report_language := normalize_supported_language(NEW.report_language);
    RETURN NEW;
END;
 LANGUAGE plpgsql;

INSERT INTO language_catalog (code, display_name, is_active, is_default)
VALUES
    ('ru', 'Russian', TRUE, TRUE),
    ('en', 'English', TRUE, FALSE),
    ('it', 'Italian', TRUE, FALSE),
    ('fr', 'French', TRUE, FALSE)
ON CONFLICT (code) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO app_config (key, value_json, value_type, scope, description)
VALUES
    ('language.default', '"ru"'::jsonb, 'string', 'global', 'Default language code for fallback logic'),
    ('language.supported', '["ru","en","it","fr"]'::jsonb, 'array', 'global', 'Supported language codes for UI/API selection'),
    ('locale.default', '"ru-RU"'::jsonb, 'string', 'global', 'Default locale for UI formatting'),
    ('timezone.default', '"Europe/Moscow"'::jsonb, 'string', 'global', 'Default timezone for timestamps'),
    ('analysis.priority.min', '1'::jsonb, 'integer', 'db', 'Minimum analysis priority'),
    ('analysis.priority.max', '9'::jsonb, 'integer', 'db', 'Maximum analysis priority'),
    ('data.retention.contract_hard_delete_days', '30'::jsonb, 'integer', 'db', 'Hard delete delay for soft-deleted contracts'),
    ('data.retention.audit_logs_days', '365'::jsonb, 'integer', 'db', 'Audit log retention period'),
    ('mobile.cache.max_contracts', '50'::jsonb, 'integer', 'mobile', 'Suggested local cache limit for contracts'),
    ('migration.runtime_target_ms', '500'::jsonb, 'integer', 'db', 'Target runtime for mobile DB migration on startup'),
    ('migration.max_complex_ops_per_release', '1'::jsonb, 'integer', 'db', 'Maximum count of complex migration operations per release'),
    ('artifact.mobile_data_target_mb', '35'::jsonb, 'integer', 'build', 'Target mobile data footprint'),
    ('artifact.mobile_data_cap_mb', '40'::jsonb, 'integer', 'build', 'Hard cap for mobile data footprint')
ON CONFLICT (key) DO UPDATE
SET
    value_json = EXCLUDED.value_json,
    value_type = EXCLUDED.value_type,
    scope = EXCLUDED.scope,
    description = EXCLUDED.description,
    updated_at = NOW();

CREATE TRIGGER trg_users_normalize_language
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trg_users_normalize_language();
CREATE TRIGGER trg_contracts_normalize_language
BEFORE INSERT OR UPDATE ON contracts
FOR EACH ROW EXECUTE FUNCTION trg_contracts_normalize_language();
CREATE TRIGGER trg_analysis_jobs_normalize_language
BEFORE INSERT OR UPDATE ON analysis_jobs
FOR EACH ROW EXECUTE FUNCTION trg_analysis_jobs_normalize_language();
CREATE TRIGGER trg_summaries_normalize_language
BEFORE INSERT OR UPDATE ON summaries
FOR EACH ROW EXECUTE FUNCTION trg_summaries_normalize_language();
CREATE INDEX idx_users_status_created_at ON users (status, created_at DESC);
CREATE INDEX idx_users_preferred_language ON users (preferred_language);

CREATE INDEX idx_role_profiles_user_id ON role_profiles (user_id);
CREATE INDEX idx_role_profiles_user_default ON role_profiles (user_id, is_default) WHERE is_default = TRUE;
CREATE UNIQUE INDEX uq_role_profiles_one_default_per_user ON role_profiles (user_id) WHERE is_default = TRUE;

CREATE INDEX idx_contracts_user_uploaded_at ON contracts (user_id, uploaded_at DESC);
CREATE INDEX idx_contracts_status_uploaded_at ON contracts (status, uploaded_at DESC);
CREATE INDEX idx_contracts_active_user ON contracts (user_id, id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_sha256 ON contracts (file_sha256);
CREATE INDEX idx_contracts_language_uploaded_at ON contracts (language_code, uploaded_at DESC);

CREATE INDEX idx_analysis_jobs_contract_created ON analysis_jobs (contract_id, created_at DESC);
CREATE INDEX idx_analysis_jobs_status_created ON analysis_jobs (status, created_at DESC);
CREATE INDEX idx_analysis_jobs_requested_by_created ON analysis_jobs (requested_by, created_at DESC);
CREATE INDEX idx_analysis_jobs_queue ON analysis_jobs (status, priority DESC, created_at ASC) WHERE status IN ('queued', 'running');
CREATE INDEX idx_analysis_jobs_report_language_created ON analysis_jobs (report_language, created_at DESC);

CREATE INDEX idx_risk_items_job_severity ON risk_items (analysis_job_id, severity, score DESC);
CREATE INDEX idx_risk_items_contract_severity ON risk_items (contract_id, severity, created_at DESC);
CREATE INDEX idx_risk_items_category ON risk_items (category);
CREATE INDEX idx_risk_items_role_impact ON risk_items (role_impact);

CREATE INDEX idx_disputed_clauses_job ON disputed_clauses (analysis_job_id, created_at DESC);
CREATE INDEX idx_disputed_clauses_contract ON disputed_clauses (contract_id, created_at DESC);
CREATE INDEX idx_disputed_clauses_role_impact ON disputed_clauses (role_impact);

CREATE INDEX idx_summaries_contract_id ON summaries (contract_id);
CREATE INDEX idx_summaries_report_language ON summaries (report_language);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_event_type_created ON audit_logs (event_type, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_contract_created ON audit_logs (contract_id, created_at DESC);
CREATE INDEX idx_audit_logs_analysis_created ON audit_logs (analysis_job_id, created_at DESC);
