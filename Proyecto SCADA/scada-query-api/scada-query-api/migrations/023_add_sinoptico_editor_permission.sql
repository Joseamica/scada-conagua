-- Granular "Editor de sinopticos" permission (not a role, per spec)
ALTER TABLE scada.permissions
    ADD COLUMN IF NOT EXISTS can_edit_sinopticos BOOLEAN NOT NULL DEFAULT false;

-- Default: Admins and Supervisors get sinoptico edit permission
UPDATE scada.permissions SET can_edit_sinopticos = true
FROM scada.users u WHERE scada.permissions.user_id = u.id AND u.role_id <= 2;
