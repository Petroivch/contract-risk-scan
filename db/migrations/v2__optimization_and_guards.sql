BEGIN;

-- Keep updated_at fields consistent without relying on app logic.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Business guardrails.
ALTER TABLE contracts
    ADD CONSTRAINT contracts_file_sha256_format_chk CHECK (file_sha256 ~ '^[0-9a-fA-F]{64}$');

ALTER TABLE analysis_jobs
    ADD CONSTRAINT analysis_jobs_timestamps_chk CHECK (
        (started_at IS NULL OR started_at >= created_at) AND
        (finished_at IS NULL OR (started_at IS NOT NULL AND finished_at >= started_at))
    );

-- Query-performance indexes.
CREATE INDEX idx_users_status_created_at ON users (status, created_at DESC);

CREATE INDEX idx_role_profiles_user_id ON role_profiles (user_id);
CREATE INDEX idx_role_profiles_user_default ON role_profiles (user_id, is_default) WHERE is_default = TRUE;
CREATE UNIQUE INDEX uq_role_profiles_one_default_per_user ON role_profiles (user_id) WHERE is_default = TRUE;

CREATE INDEX idx_contracts_user_uploaded_at ON contracts (user_id, uploaded_at DESC);
CREATE INDEX idx_contracts_status_uploaded_at ON contracts (status, uploaded_at DESC);
CREATE INDEX idx_contracts_active_user ON contracts (user_id, id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_sha256 ON contracts (file_sha256);

CREATE INDEX idx_analysis_jobs_contract_created ON analysis_jobs (contract_id, created_at DESC);
CREATE INDEX idx_analysis_jobs_status_created ON analysis_jobs (status, created_at DESC);
CREATE INDEX idx_analysis_jobs_requested_by_created ON analysis_jobs (requested_by, created_at DESC);
CREATE INDEX idx_analysis_jobs_queue ON analysis_jobs (status, priority DESC, created_at ASC) WHERE status IN ('queued', 'running');

CREATE INDEX idx_risk_items_job_severity ON risk_items (analysis_job_id, severity, score DESC);
CREATE INDEX idx_risk_items_contract_severity ON risk_items (contract_id, severity, created_at DESC);
CREATE INDEX idx_risk_items_category ON risk_items (category);
CREATE INDEX idx_risk_items_role_impact ON risk_items (role_impact);

CREATE INDEX idx_disputed_clauses_job ON disputed_clauses (analysis_job_id, created_at DESC);
CREATE INDEX idx_disputed_clauses_contract ON disputed_clauses (contract_id, created_at DESC);
CREATE INDEX idx_disputed_clauses_role_impact ON disputed_clauses (role_impact);

CREATE INDEX idx_summaries_contract_id ON summaries (contract_id);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_event_type_created ON audit_logs (event_type, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_contract_created ON audit_logs (contract_id, created_at DESC);
CREATE INDEX idx_audit_logs_analysis_created ON audit_logs (analysis_job_id, created_at DESC);

COMMIT;
