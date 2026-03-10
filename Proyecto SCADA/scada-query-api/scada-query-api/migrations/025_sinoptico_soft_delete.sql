-- Soft delete for sinopticos
ALTER TABLE scada.sinopticos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_sinopticos_deleted ON scada.sinopticos(deleted_at) WHERE deleted_at IS NOT NULL;
