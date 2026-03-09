-- Alarm groups: hierarchical grouping for alarm definitions
CREATE TABLE IF NOT EXISTS scada.alarm_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_group_id INTEGER REFERENCES scada.alarm_groups(id) ON DELETE SET NULL,
    municipality VARCHAR(100),
    estado_id INTEGER DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES scada.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
