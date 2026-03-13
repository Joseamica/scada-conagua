-- 032_view_columns_unique_constraint.sql
-- Prevent duplicate columns (same dev_eui + measurement) within a single view

BEGIN;

-- Remove any existing duplicates (keep the one with the lowest id)
DELETE FROM scada.view_columns a
USING scada.view_columns b
WHERE a.view_id = b.view_id
  AND a.dev_eui = b.dev_eui
  AND a.measurement = b.measurement
  AND a.id > b.id;

ALTER TABLE scada.view_columns
    ADD CONSTRAINT view_columns_view_deveui_measurement_unique
    UNIQUE (view_id, dev_eui, measurement);

COMMIT;
