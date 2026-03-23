BEGIN;

CREATE TABLE IF NOT EXISTS scada.gis_views (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    name         VARCHAR(128) NOT NULL,
    description  TEXT,
    view_state   JSONB NOT NULL,
    is_public    BOOLEAN NOT NULL DEFAULT false,
    municipio_id INTEGER NOT NULL DEFAULT 0,
    estado_id    INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gis_views_user ON scada.gis_views(user_id);
CREATE INDEX IF NOT EXISTS idx_gis_views_municipio ON scada.gis_views(municipio_id);
CREATE INDEX IF NOT EXISTS idx_gis_views_public ON scada.gis_views(is_public) WHERE is_public = true;

COMMIT;
