-- 038: Add UNIQUE constraint to measurement_catalog.key + deduplicate
-- Migration 037 created the table without UNIQUE(key), making ON CONFLICT DO NOTHING inoperative.

-- Remove duplicates keeping the row with the lowest id
DELETE FROM scada.measurement_catalog
WHERE id NOT IN (
    SELECT MIN(id) FROM scada.measurement_catalog GROUP BY key
);

-- Add the missing unique constraint
ALTER TABLE scada.measurement_catalog
    ADD CONSTRAINT measurement_catalog_key_unique UNIQUE (key);
