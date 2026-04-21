-- Runtime validation for PostgreSQL after applying v1..v4 migrations.
-- Usage example:
--   createdb contract_risk_scanner
--   psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/migrations/v1__init_schema.sql
--   psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/migrations/v2__optimization_and_guards.sql
--   psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/migrations/v3__language_support.sql
--   psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/migrations/v4__config_registry_and_invariants.sql
--   psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/validation/validate_postgres_runtime.sql

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    active_language_count INTEGER;
    default_language_count INTEGER;
    configured_default TEXT;
    supported_codes JSONB;
    config_supported_codes JSONB;
    priority_min INTEGER;
    priority_max INTEGER;
    release_limit_mb INTEGER;
    db_target_mb INTEGER;
    db_hard_cap_mb INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_language_count
    FROM language_catalog
    WHERE is_active = TRUE;

    IF active_language_count = 0 THEN
        RAISE EXCEPTION 'validation failed: language_catalog must have at least one active language';
    END IF;

    SELECT COUNT(*) INTO default_language_count
    FROM language_catalog
    WHERE is_active = TRUE
      AND is_default = TRUE;

    IF default_language_count <> 1 THEN
        RAISE EXCEPTION 'validation failed: expected exactly one active default language, got %', default_language_count;
    END IF;

    SELECT trim(both '"' FROM value_json::text)
    INTO configured_default
    FROM app_config
    WHERE key = 'language.default'
      AND value_type = 'string';

    IF configured_default IS NULL THEN
        RAISE EXCEPTION 'validation failed: missing app_config.language.default';
    END IF;

    IF configured_default <> get_default_language_code() THEN
        RAISE EXCEPTION 'validation failed: app_config.language.default (%) != language_catalog default (%)',
            configured_default,
            get_default_language_code();
    END IF;

    SELECT COALESCE(jsonb_agg(code ORDER BY code), '[]'::jsonb)
    INTO supported_codes
    FROM language_catalog
    WHERE is_active = TRUE;

    SELECT value_json
    INTO config_supported_codes
    FROM app_config
    WHERE key = 'language.supported'
      AND value_type = 'array';

    IF config_supported_codes IS NULL THEN
        RAISE EXCEPTION 'validation failed: missing app_config.language.supported';
    END IF;

    IF config_supported_codes <> supported_codes THEN
        RAISE EXCEPTION 'validation failed: app_config.language.supported (%) != active language_catalog (%)',
            config_supported_codes,
            supported_codes;
    END IF;

    priority_min := get_config_integer('analysis.priority.min');
    priority_max := get_config_integer('analysis.priority.max');
    IF priority_min < 1 OR priority_max > 9 OR priority_min > priority_max THEN
        RAISE EXCEPTION 'validation failed: analysis priority range must satisfy 1 <= min <= max <= 9';
    END IF;

    release_limit_mb := get_config_integer('build.final_release_size_limit_mb');
    db_target_mb := get_config_integer('build.db_contribution_target_mb');
    db_hard_cap_mb := get_config_integer('build.db_contribution_hard_cap_mb');
    IF db_target_mb > db_hard_cap_mb OR db_hard_cap_mb > release_limit_mb THEN
        RAISE EXCEPTION 'validation failed: build size config must satisfy target <= hard cap <= final limit';
    END IF;
END $$;

DO $$
DECLARE
    actual_default TEXT;
    actual_report_default TEXT;
    actual_contract_default TEXT;
    actual_locale_default TEXT;
    actual_timezone_default TEXT;
BEGIN
    SELECT column_default INTO actual_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'preferred_language';

    SELECT column_default INTO actual_report_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analysis_jobs'
      AND column_name = 'report_language';

    SELECT column_default INTO actual_contract_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contracts'
      AND column_name = 'language_code';

    SELECT column_default INTO actual_locale_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'locale';

    SELECT column_default INTO actual_timezone_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'timezone';

    IF actual_default NOT LIKE '%get_default_language_code%' THEN
        RAISE EXCEPTION 'validation failed: users.preferred_language default is not bound to get_default_language_code()';
    END IF;

    IF actual_report_default NOT LIKE '%get_default_language_code%' THEN
        RAISE EXCEPTION 'validation failed: analysis_jobs.report_language default is not bound to get_default_language_code()';
    END IF;

    IF actual_contract_default NOT LIKE '%get_default_language_code%' THEN
        RAISE EXCEPTION 'validation failed: contracts.language_code default is not bound to get_default_language_code()';
    END IF;

    IF actual_locale_default NOT LIKE '%get_config_string%' THEN
        RAISE EXCEPTION 'validation failed: users.locale default is not bound to get_config_string()';
    END IF;

    IF actual_timezone_default NOT LIKE '%get_config_string%' THEN
        RAISE EXCEPTION 'validation failed: users.timezone default is not bound to get_config_string()';
    END IF;
END $$;

DO $$
BEGIN
    UPDATE app_config
    SET value_json = '"en"'::jsonb
    WHERE key = 'language.default';

    IF get_default_language_code() <> 'en' THEN
        RAISE EXCEPTION 'validation failed: app_config -> language_catalog default sync is broken';
    END IF;

    UPDATE language_catalog
    SET is_active = FALSE
    WHERE code = 'en';

    IF get_default_language_code() = 'en' THEN
        RAISE EXCEPTION 'validation failed: inactive default language was not reassigned';
    END IF;

    IF (
        SELECT trim(both '"' FROM value_json::text)
        FROM app_config
        WHERE key = 'language.default'
    ) <> get_default_language_code() THEN
        RAISE EXCEPTION 'validation failed: language.default did not resync after catalog update';
    END IF;

    IF (
        SELECT value_json
        FROM app_config
        WHERE key = 'language.supported'
    ) <> (
        SELECT jsonb_agg(code ORDER BY code)
        FROM language_catalog
        WHERE is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'validation failed: language.supported did not resync after catalog update';
    END IF;
END $$;

DO $$
BEGIN
    INSERT INTO users (email, preferred_language, locale, timezone)
    VALUES ('runtime-validation@example.test', 'zz', 'bad', '');
EXCEPTION
    WHEN check_violation THEN
        NULL;
END $$;

-- The row above must not exist because invalid locale/timezone are rejected.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM users
        WHERE email = 'runtime-validation@example.test'
    ) THEN
        RAISE EXCEPTION 'validation failed: invalid user row unexpectedly inserted';
    END IF;
END $$;

ROLLBACK;
