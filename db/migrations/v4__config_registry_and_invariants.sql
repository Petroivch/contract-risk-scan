BEGIN;

-- Shared trigger helper (idempotent redefinition).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Central configuration registry to avoid magic numbers/hardcoded policies in app code.
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

DROP TRIGGER IF EXISTS trg_app_config_updated_at ON app_config;
CREATE TRIGGER trg_app_config_updated_at
BEFORE UPDATE ON app_config
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Language registry replaces duplicated hardcoded language lists.
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

DROP TRIGGER IF EXISTS trg_language_catalog_updated_at ON language_catalog;
CREATE TRIGGER trg_language_catalog_updated_at
BEFORE UPDATE ON language_catalog
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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

DO $$
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

        IF default_code IS NOT NULL THEN
            PERFORM set_default_language_code(default_code);
        END IF;
    END IF;
END $$;

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

-- Normalize existing data before switching constraints.
UPDATE users
SET preferred_language = normalize_supported_language(preferred_language)
WHERE preferred_language IS DISTINCT FROM normalize_supported_language(preferred_language);

UPDATE contracts
SET language_code = normalize_supported_language(language_code)
WHERE language_code IS DISTINCT FROM normalize_supported_language(language_code);

UPDATE analysis_jobs
SET report_language = normalize_supported_language(report_language)
WHERE report_language IS DISTINCT FROM normalize_supported_language(report_language);

UPDATE summaries
SET report_language = normalize_supported_language(report_language)
WHERE report_language IS DISTINCT FROM normalize_supported_language(report_language);

-- Remove duplicated hardcoded checks from v3.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_language_chk;
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_language_code_chk;
ALTER TABLE analysis_jobs DROP CONSTRAINT IF EXISTS analysis_jobs_report_language_chk;
ALTER TABLE summaries DROP CONSTRAINT IF EXISTS summaries_report_language_chk;

-- Keep language_code strict and consistent.
ALTER TABLE contracts
    ALTER COLUMN language_code TYPE VARCHAR(2)
    USING normalize_supported_language(language_code);

ALTER TABLE users ALTER COLUMN preferred_language SET DEFAULT get_default_language_code();
ALTER TABLE contracts ALTER COLUMN language_code SET DEFAULT get_default_language_code();
ALTER TABLE analysis_jobs ALTER COLUMN report_language SET DEFAULT get_default_language_code();
ALTER TABLE summaries ALTER COLUMN report_language SET DEFAULT get_default_language_code();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_preferred_language_fk') THEN
        ALTER TABLE users
            ADD CONSTRAINT users_preferred_language_fk
            FOREIGN KEY (preferred_language) REFERENCES language_catalog(code);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_language_code_fk') THEN
        ALTER TABLE contracts
            ADD CONSTRAINT contracts_language_code_fk
            FOREIGN KEY (language_code) REFERENCES language_catalog(code);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analysis_jobs_report_language_fk') THEN
        ALTER TABLE analysis_jobs
            ADD CONSTRAINT analysis_jobs_report_language_fk
            FOREIGN KEY (report_language) REFERENCES language_catalog(code);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'summaries_report_language_fk') THEN
        ALTER TABLE summaries
            ADD CONSTRAINT summaries_report_language_fk
            FOREIGN KEY (report_language) REFERENCES language_catalog(code);
    END IF;
END $$;

-- Seed policy defaults (configurable via app_config updates, no code hardcoding required).
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
    ('artifact.mobile_data_target_mb', '35'::jsonb, 'integer', 'build', 'Target mobile data contribution in packaged artifacts'),
    ('artifact.mobile_data_cap_mb', '40'::jsonb, 'integer', 'build', 'Hard cap for mobile data contribution in packaged artifacts')
ON CONFLICT (key) DO UPDATE
SET
    value_json = EXCLUDED.value_json,
    value_type = EXCLUDED.value_type,
    scope = EXCLUDED.scope,
    description = EXCLUDED.description,
    updated_at = NOW();

DO $$
DECLARE
    configured_default VARCHAR(2);
    fallback_default VARCHAR(2);
BEGIN
    SELECT trim(both '"' FROM value_json::text)::VARCHAR(2)
    INTO configured_default
    FROM app_config
    WHERE key = 'language.default'
      AND value_type = 'string'
    LIMIT 1;

    SELECT code
    INTO fallback_default
    FROM language_catalog
    WHERE is_active = TRUE
    ORDER BY code
    LIMIT 1;

    IF configured_default IS NULL THEN
        configured_default := fallback_default;
    END IF;

    IF configured_default IS NOT NULL
       AND EXISTS (SELECT 1 FROM language_catalog WHERE code = configured_default AND is_active = TRUE) THEN
        PERFORM set_default_language_code(configured_default);
    ELSIF fallback_default IS NOT NULL THEN
        PERFORM set_default_language_code(fallback_default);
    END IF;
END $$;

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
        'artifact.mobile_data_target_mb',
        'artifact.mobile_data_cap_mb'
    ) THEN
        IF NEW.value_type <> 'integer' THEN
            RAISE EXCEPTION '% must use integer value_type', NEW.key;
        END IF;

        effective_db_target_mb := CASE
            WHEN NEW.key = 'artifact.mobile_data_target_mb' THEN (NEW.value_json::text)::INTEGER
            ELSE COALESCE(
                (SELECT (value_json::text)::INTEGER FROM app_config WHERE key = 'artifact.mobile_data_target_mb' LIMIT 1),
                35
            )
        END;
        effective_db_hard_cap_mb := CASE
            WHEN NEW.key = 'artifact.mobile_data_cap_mb' THEN (NEW.value_json::text)::INTEGER
            ELSE COALESCE(
                (SELECT (value_json::text)::INTEGER FROM app_config WHERE key = 'artifact.mobile_data_cap_mb' LIMIT 1),
                40
            )
        END;

        IF effective_db_target_mb <= 0 OR effective_db_hard_cap_mb <= 0 THEN
            RAISE EXCEPTION 'artifact size config must be positive integers';
        END IF;

        IF effective_db_target_mb > effective_db_hard_cap_mb THEN
            RAISE EXCEPTION 'artifact size config must satisfy target <= cap';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_config_enforce_invariants ON app_config;
CREATE TRIGGER trg_app_config_enforce_invariants
BEFORE INSERT OR UPDATE ON app_config
FOR EACH ROW EXECUTE FUNCTION trg_app_config_enforce_invariants();

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

DROP TRIGGER IF EXISTS trg_app_config_sync_language_default ON app_config;
CREATE TRIGGER trg_app_config_sync_language_default
AFTER INSERT OR UPDATE OF value_json ON app_config
FOR EACH ROW
WHEN (NEW.key = 'language.default')
EXECUTE FUNCTION trg_app_config_sync_language_default();

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

DROP TRIGGER IF EXISTS trg_language_catalog_sync_config ON language_catalog;
CREATE TRIGGER trg_language_catalog_sync_config
AFTER INSERT OR UPDATE OR DELETE ON language_catalog
FOR EACH STATEMENT EXECUTE FUNCTION trg_language_catalog_sync_config();

UPDATE users
SET locale = get_config_string('locale.default')
WHERE locale IS NULL OR locale !~ '^[a-z]{2}-[A-Z]{2}$';

UPDATE users
SET timezone = get_config_string('timezone.default')
WHERE timezone IS NULL OR btrim(timezone) = '';

ALTER TABLE users ALTER COLUMN locale SET DEFAULT get_config_string('locale.default');
ALTER TABLE users ALTER COLUMN timezone SET DEFAULT get_config_string('timezone.default');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_locale_format_chk') THEN
        ALTER TABLE users
            ADD CONSTRAINT users_locale_format_chk
            CHECK (locale ~ '^[a-z]{2}-[A-Z]{2}$');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_timezone_not_blank_chk') THEN
        ALTER TABLE users
            ADD CONSTRAINT users_timezone_not_blank_chk
            CHECK (btrim(timezone) <> '');
    END IF;
END $$;

COMMIT;
