-- Migration 027: Document 'pendiente' as valid estatus value
-- estatus is VARCHAR(20) without CHECK constraint, so no ALTER needed.
-- This migration serves as documentation and ensures the comment is set.

COMMENT ON COLUMN scada.inventory.estatus IS 'Valid values: activo, obra, inactivo, pendiente';
