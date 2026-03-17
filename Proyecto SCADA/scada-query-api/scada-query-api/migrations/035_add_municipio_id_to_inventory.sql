-- 035: Add municipio_id FK to inventory for integer-based scope filtering
-- Replaces fragile LOWER(TRIM(municipality)) string matching with fast integer comparison

BEGIN;

-- 1. Fix Chicoloapan INEGI code: 28 → 29
UPDATE scada.entities SET municipio_id = 29 WHERE name = 'Chicoloapan' AND municipio_id = 28;

-- 2. Create missing municipal entities (Estado de Mexico, parent=OCAVM id=2)
INSERT INTO scada.entities (name, level, parent_id, estado_id, municipio_id) VALUES
    ('Texcoco',        'Municipal', 2, 15, 99),
    ('Chimalhuacan',   'Municipal', 2, 15, 31),
    ('Nezahualcoyotl', 'Municipal', 2, 15, 58)
ON CONFLICT DO NOTHING;

-- 3. Add municipio_id column (nullable = fail-open: NULL means no scope restriction)
ALTER TABLE scada.inventory ADD COLUMN IF NOT EXISTS municipio_id INTEGER;

-- 4. Normalize production name variants before backfill
--    "ECATEPEC DE MORELOS" → "Ecatepec" (matches entity)
UPDATE scada.inventory SET municipality = 'Ecatepec'
WHERE LOWER(TRIM(municipality)) = 'ecatepec de morelos';

--    "CHALCO" (uppercase) → "Chalco" (matches entity)
UPDATE scada.inventory SET municipality = 'Chalco'
WHERE LOWER(TRIM(municipality)) = 'chalco' AND municipality != 'Chalco';

--    "IXTAPALUCA" (uppercase) → "Ixtapaluca" (matches entity)
UPDATE scada.inventory SET municipality = 'Ixtapaluca'
WHERE LOWER(TRIM(municipality)) = 'ixtapaluca' AND municipality != 'Ixtapaluca';

-- 5. Backfill from municipality text → entities.municipio_id
UPDATE scada.inventory i
SET municipio_id = e.municipio_id
FROM scada.entities e
WHERE LOWER(TRIM(i.municipality)) = LOWER(TRIM(e.name))
  AND e.level = 'Municipal'
  AND i.municipio_id IS NULL;

-- 6. Index for scope filter performance
CREATE INDEX IF NOT EXISTS idx_inventory_municipio_id ON scada.inventory(municipio_id);

COMMIT;
