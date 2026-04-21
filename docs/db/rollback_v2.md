# Откат: v2__optimization_and_guards.sql

## Порядок отката
Если применены более новые миграции:
1. Сначала откатить `v4` (`docs/db/rollback_v4.md`).
2. Затем откатить `v3` (`docs/db/rollback_v3.md`).
3. Только после этого откатывать `v2`.

## SQL для отката v2
```sql
BEGIN;

DROP INDEX IF EXISTS idx_audit_logs_analysis_created;
DROP INDEX IF EXISTS idx_audit_logs_contract_created;
DROP INDEX IF EXISTS idx_audit_logs_user_created;
DROP INDEX IF EXISTS idx_audit_logs_event_type_created;
DROP INDEX IF EXISTS idx_audit_logs_created_at;

DROP INDEX IF EXISTS idx_summaries_contract_id;

DROP INDEX IF EXISTS idx_disputed_clauses_role_impact;
DROP INDEX IF EXISTS idx_disputed_clauses_contract;
DROP INDEX IF EXISTS idx_disputed_clauses_job;

DROP INDEX IF EXISTS idx_risk_items_role_impact;
DROP INDEX IF EXISTS idx_risk_items_category;
DROP INDEX IF EXISTS idx_risk_items_contract_severity;
DROP INDEX IF EXISTS idx_risk_items_job_severity;

DROP INDEX IF EXISTS idx_analysis_jobs_queue;
DROP INDEX IF EXISTS idx_analysis_jobs_requested_by_created;
DROP INDEX IF EXISTS idx_analysis_jobs_status_created;
DROP INDEX IF EXISTS idx_analysis_jobs_contract_created;

DROP INDEX IF EXISTS idx_contracts_sha256;
DROP INDEX IF EXISTS idx_contracts_active_user;
DROP INDEX IF EXISTS idx_contracts_status_uploaded_at;
DROP INDEX IF EXISTS idx_contracts_user_uploaded_at;

DROP INDEX IF EXISTS uq_role_profiles_one_default_per_user;
DROP INDEX IF EXISTS idx_role_profiles_user_default;
DROP INDEX IF EXISTS idx_role_profiles_user_id;

DROP INDEX IF EXISTS idx_users_status_created_at;

ALTER TABLE IF EXISTS analysis_jobs
    DROP CONSTRAINT IF EXISTS analysis_jobs_timestamps_chk;

ALTER TABLE IF EXISTS contracts
    DROP CONSTRAINT IF EXISTS contracts_file_sha256_format_chk;

DROP TRIGGER IF EXISTS trg_summaries_updated_at ON summaries;
DROP TRIGGER IF EXISTS trg_disputed_clauses_updated_at ON disputed_clauses;
DROP TRIGGER IF EXISTS trg_risk_items_updated_at ON risk_items;
DROP TRIGGER IF EXISTS trg_analysis_jobs_updated_at ON analysis_jobs;
DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
DROP TRIGGER IF EXISTS trg_role_profiles_updated_at ON role_profiles;
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

DROP FUNCTION IF EXISTS set_updated_at();

COMMIT;
```
