-- 005_create_permissions_table.sql
-- Granular per-user permissions

CREATE TABLE IF NOT EXISTS scada.permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    can_view BOOLEAN NOT NULL DEFAULT true,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_export BOOLEAN NOT NULL DEFAULT false,
    can_block BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Seed defaults based on current roles:
-- Admin gets all, Supervisor gets view+edit+export, Operador gets view+edit, Tecnico gets view only
INSERT INTO scada.permissions (user_id, can_view, can_edit, can_export, can_block)
SELECT id, true,
       role_id <= 3,  -- Operador+ can edit
       role_id <= 2,  -- Supervisor+ can export
       role_id = 1    -- Only Admin can block
FROM scada.users
ON CONFLICT (user_id) DO NOTHING;
