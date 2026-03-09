-- Activity log for sinoptico edits (versionamiento = activity log per spec)
CREATE TABLE IF NOT EXISTS scada.sinoptico_activity_log (
    id SERIAL PRIMARY KEY,
    sinoptico_id INTEGER NOT NULL REFERENCES scada.sinopticos(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sinoptico_activity ON scada.sinoptico_activity_log(sinoptico_id, created_at DESC);
