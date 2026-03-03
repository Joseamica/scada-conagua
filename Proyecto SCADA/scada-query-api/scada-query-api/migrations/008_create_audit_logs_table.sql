-- 008_create_audit_logs_table.sql
-- Idempotent: formalizes the existing audit_logs table with proper indexes

CREATE TABLE IF NOT EXISTS scada.audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES scada.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON scada.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON scada.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON scada.audit_logs(action);
