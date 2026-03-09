-- Sinoptico sharing: per-user read/edit access
CREATE TABLE IF NOT EXISTS scada.sinoptico_shares (
    id SERIAL PRIMARY KEY,
    sinoptico_id INTEGER NOT NULL REFERENCES scada.sinopticos(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    permission VARCHAR(10) NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'edit')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sinoptico_id, user_id)
);
