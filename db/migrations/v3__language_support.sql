BEGIN;

-- 1) Add language fields required by product
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) NOT NULL DEFAULT 'ru';

ALTER TABLE analysis_jobs
    ADD COLUMN IF NOT EXISTS report_language VARCHAR(2) NOT NULL DEFAULT 'ru';

ALTER TABLE summaries
    ADD COLUMN IF NOT EXISTS report_language VARCHAR(2) NOT NULL DEFAULT 'ru';

-- 2) Fallback helper: null/invalid -> ru
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

-- Normalize existing legacy values before adding checks.
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

-- 3) Add/strengthen language constraints
ALTER TABLE users
    ADD CONSTRAINT users_preferred_language_chk
    CHECK (preferred_language IN ('ru', 'en', 'it', 'fr'));

ALTER TABLE analysis_jobs
    ADD CONSTRAINT analysis_jobs_report_language_chk
    CHECK (report_language IN ('ru', 'en', 'it', 'fr'));

ALTER TABLE summaries
    ADD CONSTRAINT summaries_report_language_chk
    CHECK (report_language IN ('ru', 'en', 'it', 'fr'));

ALTER TABLE contracts
    ADD CONSTRAINT contracts_language_code_chk
    CHECK (language_code IN ('ru', 'en', 'it', 'fr'));

-- 4) Fallback behavior at DB level for future writes
CREATE OR REPLACE FUNCTION trg_users_normalize_language()
RETURNS TRIGGER AS $$
BEGIN
    NEW.preferred_language := normalize_supported_language(NEW.preferred_language);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_contracts_normalize_language()
RETURNS TRIGGER AS $$
BEGIN
    NEW.language_code := normalize_supported_language(NEW.language_code);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_analysis_jobs_normalize_language()
RETURNS TRIGGER AS $$
BEGIN
    NEW.report_language := normalize_supported_language(NEW.report_language);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_summaries_normalize_language()
RETURNS TRIGGER AS $$
BEGIN
    NEW.report_language := normalize_supported_language(NEW.report_language);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- 5) Language-oriented indexes for filtering and analytics
CREATE INDEX idx_users_preferred_language ON users (preferred_language);
CREATE INDEX idx_contracts_language_uploaded_at ON contracts (language_code, uploaded_at DESC);
CREATE INDEX idx_analysis_jobs_report_language_created ON analysis_jobs (report_language, created_at DESC);
CREATE INDEX idx_summaries_report_language ON summaries (report_language);

COMMIT;
