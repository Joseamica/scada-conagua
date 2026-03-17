-- Migration 036: Add utr_id column to inventory table
-- Requested by Anibal: field "ID UTR" in site edit form was not persisted

ALTER TABLE scada.inventory ADD COLUMN IF NOT EXISTS utr_id VARCHAR(50);

COMMENT ON COLUMN scada.inventory.utr_id IS 'Identificador de la Unidad Terminal Remota (UTR) del sitio';
