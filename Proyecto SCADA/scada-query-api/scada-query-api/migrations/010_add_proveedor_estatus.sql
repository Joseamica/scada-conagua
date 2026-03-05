-- Add proveedor and estatus columns to inventory table
-- proveedor: '4PT' or 'ICH' (nullable for legacy sites)
-- estatus: 'activo' | 'obra' | 'inactivo' (default 'activo' for retrocompatibility)

ALTER TABLE scada.inventory
  ADD COLUMN IF NOT EXISTS proveedor VARCHAR(50),
  ADD COLUMN IF NOT EXISTS estatus VARCHAR(20) DEFAULT 'activo';
