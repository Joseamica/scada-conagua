-- 009_add_can_operate_permission.sql
-- Adds can_operate permission for pump START/STOP control

BEGIN;

ALTER TABLE scada.permissions
  ADD COLUMN IF NOT EXISTS can_operate BOOLEAN NOT NULL DEFAULT false;

-- Seed existing Admins (role_id=1) and Supervisors (role_id=2) with can_operate = true
UPDATE scada.permissions p
   SET can_operate = true
  FROM scada.users u
 WHERE u.id = p.user_id
   AND u.role_id <= 2;

COMMIT;
