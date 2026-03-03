-- 003_users_entity_id_and_roles.sql
-- Adds entity_id to users and normalizes role names to SOA spec
--
-- Current state: 1=Administrador, 2=Ejecutivo, 3=Supervisor, 4=Operador
-- Target state:  1=Administrador, 2=Supervisor, 3=Operador,   4=Tecnico
--
-- Rename order matters due to UNIQUE constraint on role_name:
-- 1. id=4 "Operador"   → "Tecnico"    (frees "Operador")
-- 2. id=3 "Supervisor"  → "Operador"   (frees "Supervisor")
-- 3. id=2 "Ejecutivo"   → "Supervisor" (frees "Ejecutivo")
-- 4. id=1 stays "Administrador"

ALTER TABLE scada.users ADD COLUMN IF NOT EXISTS entity_id INTEGER REFERENCES scada.entities(id);

CREATE INDEX IF NOT EXISTS idx_users_entity ON scada.users(entity_id);

UPDATE scada.roles SET role_name = 'Tecnico'       WHERE id = 4;
UPDATE scada.roles SET role_name = 'Operador'       WHERE id = 3;
UPDATE scada.roles SET role_name = 'Supervisor'     WHERE id = 2;
-- id=1 is already 'Administrador', no change needed
