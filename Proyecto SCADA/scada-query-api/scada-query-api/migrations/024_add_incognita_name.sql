-- Migration 024: Add incognita_name column to view_columns for persistence
BEGIN;

ALTER TABLE scada.view_columns
    ADD COLUMN IF NOT EXISTS incognita_name VARCHAR(100);

COMMIT;
