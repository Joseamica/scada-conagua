-- 004_seed_user_entities.sql
-- Assign entity_id to existing users based on their scope/estado_id/scope_id

-- Federal users → CONAGUA (entity 1)
UPDATE scada.users SET entity_id = 1
WHERE scope = 'Federal' AND entity_id IS NULL;

-- Estatal users → match by estado_id to OCAVM or CAEM
UPDATE scada.users u SET entity_id = e.id
FROM scada.entities e
WHERE u.scope = 'Estatal'
  AND e.level = 'Estatal'
  AND e.estado_id = u.estado_id
  AND u.entity_id IS NULL;

-- Municipal users → match by estado_id + municipio_id
UPDATE scada.users u SET entity_id = e.id
FROM scada.entities e
WHERE u.scope = 'Municipal'
  AND e.level = 'Municipal'
  AND e.estado_id = u.estado_id
  AND e.municipio_id = u.scope_id
  AND u.entity_id IS NULL;
