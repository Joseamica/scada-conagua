-- Sinoptico projects: top-level grouping for sinopticos
CREATE TABLE IF NOT EXISTS scada.sinoptico_projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    entity_id INTEGER REFERENCES scada.entities(id) ON DELETE SET NULL,
    estado_id INTEGER NOT NULL DEFAULT 0,
    municipio_id INTEGER NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sinoptico_projects_owner ON scada.sinoptico_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_sinoptico_projects_municipio ON scada.sinoptico_projects(municipio_id);
