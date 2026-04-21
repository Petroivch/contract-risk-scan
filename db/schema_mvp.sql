-- Contract Risk Scanner
-- MVP database schema snapshot (after migrations v1..v4).
-- Source of truth for deployment:
--   db/migrations/v1__init_schema.sql
--   db/migrations/v2__optimization_and_guards.sql
--   db/migrations/v3__language_support.sql
--   db/migrations/v4__config_registry_and_invariants.sql
-- Note: default inserts into app_config/language_catalog are applied by v4 migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE OR REPLACE FUNCTION trg_app_config_enforce_invariants()
RETURNS TRIGGER AS $$
DECLARE
    requested_default VARCHAR(2);
    effective_priority_min INTEGER;
    effective_priority_max INTEGER;
    effective_db_target_mb INTEGER;
    effective_db_hard_cap_mb INTEGER;
    effective_release_limit_mb INTEGER;
BEGIN
    IF NEW.key = 'language.supported' THEN
        NEW.value_json := COALESCE(
            (SELECT jsonb_agg(code ORDER BY code) FROM language_catalog WHERE is_active = TRUE),
            '[]'::jsonb
        );
        NEW.value_type := 'array';
    ELSIF NEW.key = 'language.default' THEN
        requested_default := lower(btrim(trim(both '"' FROM NEW.value_json::text)));

        IF requested_default IS NULL OR requested_default = '' THEN
            RAISE EXCEPTION 'language.default must be a non-empty active language code';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM language_catalog
            WHERE code = requested_default
              AND is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'language.default must reference an active language_catalog code: %', requested_default;
        END IF;

        NEW.value_json := to_jsonb(requested_default);
        NEW.value_type := 'string';
    ELSIF NEW.key IN ('analysis.priority.min', 'analysis.priority.max') THEN
        IF NEW.value_type <> 'integer' THEN
            RAISE EXCEPTION '% must use integer value_type', NEW.key;
        END IF;

        effective_priority_min := CASE
            WHEN NEW.key = 'analysis.priority.min' THEN (NEW.value_json::text)::INTEGER
            ELSE COALESCE(
                (SELECT (value_json::text)::INTEGER FROM app_config WHERE key = 'analysis.priority.min' LIMIT 1),
                1
            )
        END;
        effective_priority_max := CASE
            WHEN NEW.key = 'analysis.priority.max' THEN (NEW.value_json::text)::INTEGER
            ELSE COALESCE(
                (SELECT (value_json::text)::INTEGER FROM app_config WHERE key = 'analysis.priority.max' LIMIT 1),
                9
            )
        END;

        IF effective_priority_min < 1 OR effective_priority_max > 9 OR effective_priority_min > effective_priority_max THEN
            RAISE EXCEPTION 'analysis priority config must satisfy 1 <= min <= max <= 9';
        END IF;
    ELSIF NEW.key IN (
        'build.db_contribution_target_mb',
        'build.db_contribution_hard_cap_mb',
        'build.final_release_size_limit_mb'
    ) THEN
        IF NEW.value_type <> 'integer' THEN
            RAISE EXCEPTION '% must use integer value_type', NEW.key;
        END IF;

        effective_db_target_mb := CASE
            WHEN NEW.key = 'build.db_contribution_target_mb' THEN (NEW.value_json::text)::INTEGER
            ELSE COALESCE(
                (SELECT (value_json::text)::INTEGER FROM app_config WHERE key = 'build.db_contribution_target_mb' LIMIT 1),
                35
            )
        END;
        effective_db_hard_cap_mb := CASE
            WHEN NEW.key = 'build.db_contribution_hard_cap_mb' THEN (NEW.value_json::text)::INTEGER
            ELSE COALESCE(
                (SELECT (value_json::text)::INTEGER FROM app_config WHERE key = 'build.db_contribution_hard_cap_mb' LIMIT 1),
                40
            )
        END;
        effective_release_limit_mb := CASE
            WHEN NEW.key = 'build.final_release_size_limit_mb' THEN (NEW.value_json::text)::INTEGER
            ELSE COALESCE(
                (SELECT (value_json::text)::INTEGER FROM app_config WHERE key = 'build.final_release_size_limit_mb' LIMIT 1),
                228
            )
        END;

        IF effective_db_target_mb <= 0 OR effective_db_hard_cap_mb <= 0 OR effective_release_limit_mb <= 0 THEN
            RAISE EXCEPTION 'build size config must be positive integers';
        END IF;

        IF effective_db_target_mb > effective_db_hard_cap_mb OR effective_db_hard_cap_mb > effective_release_limit_mb THEN
            RAISE EXCEPTION 'build size config must satisfy target <= hard cap <= final release limit';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_app_config_sync_language_default()
RETURNS TRIGGER AS $$
DECLARE
    requested_default VARCHAR(2);
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    requested_default := lower(btrim(trim(both '"' FROM NEW.value_json::text)));

    PERFORM set_default_language_code(requested_default);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_language_catalog_sync_config()
RETURNS TRIGGER AS $$
DECLARE
    active_language_count INTEGER;
    default_code VARCHAR(2);
    supported_codes JSONB;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*)
    INTO active_language_count
    FROM language_catalog
    WHERE is_active = TRUE;

    IF active_language_count = 0 THEN
        RAISE EXCEPTION 'language_catalog must contain at least one active language';
    END IF;

    SELECT code
    INTO default_code
    FROM language_catalog
    WHERE is_default = TRUE
      AND is_active = TRUE
    ORDER BY code
    LIMIT 1;

    IF default_code IS NULL THEN
        SELECT code
        INTO default_code
        FROM language_catalog
        WHERE is_active = TRUE
        ORDER BY code
        LIMIT 1;

        PERFORM set_default_language_code(default_code);
    ELSE
        UPDATE language_catalog
        SET is_default = FALSE
        WHERE is_default = TRUE
          AND (code <> default_code OR is_active = FALSE);
    END IF;

    SELECT COALESCE(jsonb_agg(code ORDER BY code), '[]'::jsonb)
    INTO supported_codes
    FROM language_catalog
    WHERE is_active = TRUE;

    INSERT INTO app_config (key, value_json, value_type, scope, description)
    VALUES (
        'language.supported',
        supported_codes,
        'array',
        'global',
        'Supported language codes for UI/API selection'
    )
    ON CONFLICT (key) DO UPDATE
    SET
        value_json = EXCLUDED.value_json,
        value_type = EXCLUDED.value_type,
        scope = EXCLUDED.scope,
        description = EXCLUDED.description,
        updated_at = NOW();

    INSERT INTO app_config (key, value_json, value_type, scope, description)
    VALUES (
        'language.default',
        to_jsonb(default_code),
        'string',
        'global',
        'Default language code for fallback logic'
    )
    ON CONFLICT (key) DO UPDATE
    SET
        value_json = EXCLUDED.value_json,
        value_type = EXCLUDED.value_type,
        scope = EXCLUDED.scope,
        description = EXCLUDED.description,
        updated_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_config_enforce_invariants ON app_config;
CREATE TRIGGER trg_app_config_enforce_invariants
BEFORE INSERT OR UPDATE ON app_config
FOR EACH ROW EXECUTE FUNCTION trg_app_config_enforce_invariants();

DROP TRIGGER IF EXISTS trg_app_config_sync_language_default ON app_config;
CREATE TRIGGER trg_app_config_sync_language_default
AFTER INSERT OR UPDATE OF value_json ON app_config
FOR EACH ROW
WHEN (NEW.key = 'language.default')
EXECUTE FUNCTION trg_app_config_sync_language_default();

DROP TRIGGER IF EXISTS trg_language_catalog_sync_config ON language_catalog;
CREATE TRIGGER trg_language_catalog_sync_config
AFTER INSERT OR UPDATE OR DELETE ON language_catalog
FOR EACH STATEMENT EXECUTE FUNCTION trg_language_catalog_sync_config();
