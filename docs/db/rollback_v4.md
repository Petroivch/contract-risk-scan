# Rollback: v4__config_registry_and_invariants.sql

## Когда использовать
- Нужно откатить конфигурационный реестр (`app_config`) и языковой справочник (`language_catalog`).
- Необходимо вернуться к модели `v3` с CHECK-ограничениями по языкам.

## Важно
- Откат удаляет таблицы `app_config` и `language_catalog`.
- Выполнять только после бэкапа.

## SQL для отката v4
```sql
BEGIN;

ALTER TABLE IF EXISTS summaries
    DROP CONSTRAINT IF EXISTS summaries_report_language_fk;

ALTER TABLE IF EXISTS analysis_jobs
    DROP CONSTRAINT IF EXISTS analysis_jobs_report_language_fk;

ALTER TABLE IF EXISTS contracts
    DROP CONSTRAINT IF EXISTS contracts_language_code_fk;

ALTER TABLE IF EXISTS users
    DROP CONSTRAINT IF EXISTS users_preferred_language_fk;

ALTER TABLE IF EXISTS users
    ALTER COLUMN preferred_language SET DEFAULT 'ru';

ALTER TABLE IF EXISTS users
    ALTER COLUMN locale SET DEFAULT 'ru-RU';

ALTER TABLE IF EXISTS users
    ALTER COLUMN timezone SET DEFAULT 'Europe/Moscow';

ALTER TABLE IF EXISTS contracts
    ALTER COLUMN language_code TYPE VARCHAR(8) USING language_code::VARCHAR(8);

ALTER TABLE IF EXISTS contracts
    ALTER COLUMN language_code SET DEFAULT 'ru';

ALTER TABLE IF EXISTS analysis_jobs
    ALTER COLUMN report_language SET DEFAULT 'ru';

ALTER TABLE IF EXISTS summaries
    ALTER COLUMN report_language SET DEFAULT 'ru';

ALTER TABLE IF EXISTS users
    ADD CONSTRAINT users_preferred_language_chk
    CHECK (preferred_language IN ('ru', 'en', 'it', 'fr'));

ALTER TABLE IF EXISTS contracts
    ADD CONSTRAINT contracts_language_code_chk
    CHECK (language_code IN ('ru', 'en', 'it', 'fr'));

ALTER TABLE IF EXISTS analysis_jobs
    ADD CONSTRAINT analysis_jobs_report_language_chk
    CHECK (report_language IN ('ru', 'en', 'it', 'fr'));

ALTER TABLE IF EXISTS summaries
    ADD CONSTRAINT summaries_report_language_chk
    CHECK (report_language IN ('ru', 'en', 'it', 'fr'));

ALTER TABLE IF EXISTS users
    DROP CONSTRAINT IF EXISTS users_locale_format_chk;

ALTER TABLE IF EXISTS users
    DROP CONSTRAINT IF EXISTS users_timezone_not_blank_chk;

DROP TRIGGER IF EXISTS trg_language_catalog_updated_at ON language_catalog;
DROP INDEX IF EXISTS uq_language_catalog_single_default;
DROP TABLE IF EXISTS language_catalog;

DROP TRIGGER IF EXISTS trg_app_config_updated_at ON app_config;
DROP TABLE IF EXISTS app_config;

DROP FUNCTION IF EXISTS get_default_language_code();
DROP FUNCTION IF EXISTS get_config_string(TEXT);

CREATE OR REPLACE FUNCTION normalize_supported_language(input_lang TEXT)
RETURNS VARCHAR(2) AS $$
BEGIN
    IF input_lang IS NULL THEN
        RETURN 'ru';
    END IF;

    input_lang := lower(input_lang);
    IF input_lang IN ('ru', 'en', 'it', 'fr') THEN
        RETURN input_lang::VARCHAR(2);
    END IF;

    RETURN 'ru';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;
```

## Проверка
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('app_config', 'language_catalog');
```

Ожидание: таблицы отсутствуют, языковые CHECK-ограничения восстановлены.
