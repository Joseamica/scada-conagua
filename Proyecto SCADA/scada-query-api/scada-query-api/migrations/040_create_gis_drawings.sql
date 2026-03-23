BEGIN;
CREATE TABLE IF NOT EXISTS scada.gis_drawings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    geojson JSONB NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6d002b',
    municipio_id INTEGER NOT NULL DEFAULT 0,
    estado_id INTEGER NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gis_drawings_user ON scada.gis_drawings(user_id);
CREATE INDEX IF NOT EXISTS idx_gis_drawings_municipio ON scada.gis_drawings(municipio_id);
COMMIT;
