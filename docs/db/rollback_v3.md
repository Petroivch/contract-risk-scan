# Откат: v3__language_support.sql

## Порядок отката
Если уже применена `v4`, сначала выполнить:
- `docs/db/rollback_v4.md`

Только после этого откатывать `v3`.

## SQL для отката v3
```sql
BEGIN;

DROP INDEX IF EXISTS idx_summaries_report_language;
DROP INDEX IF EXISTS idx_analysis_jobs_report_language_created;
DROP INDEX IF EXISTS idx_contracts_language_uploaded_at;
DROP INDEX IF EXISTS idx_users_preferred_language;

DROP TRIGGER IF EXISTS trg_summaries_normalize_language ON summaries;
DROP TRIGGER IF EXISTS trg_analysis_jobs_normalize_language ON analysis_jobs;
DROP TRIGGER IF EXISTS trg_contracts_normalize_language ON contracts;
DROP TRIGGER IF EXISTS trg_users_normalize_language ON users;

DROP FUNCTION IF EXISTS trg_summaries_normalize_language();
DROP FUNCTION IF EXISTS trg_analysis_jobs_normalize_language();
DROP FUNCTION IF EXISTS trg_contracts_normalize_language();
DROP FUNCTION IF EXISTS trg_users_normalize_language();
DROP FUNCTION IF EXISTS normalize_supported_language(TEXT);

ALTER TABLE IF EXISTS summaries
    DROP CONSTRAINT IF EXISTS summaries_report_language_chk;

ALTER TABLE IF EXISTS analysis_jobs
    DROP CONSTRAINT IF EXISTS analysis_jobs_report_language_chk;

ALTER TABLE IF EXISTS contracts
    DROP CONSTRAINT IF EXISTS contracts_language_code_chk;

ALTER TABLE IF EXISTS users
    DROP CONSTRAINT IF EXISTS users_preferred_language_chk;

ALTER TABLE IF EXISTS summaries
    DROP COLUMN IF EXISTS report_language;

ALTER TABLE IF EXISTS analysis_jobs
    DROP COLUMN IF EXISTS report_language;

ALTER TABLE IF EXISTS users
    DROP COLUMN IF EXISTS preferred_language;

COMMIT;
```
