-- Sinopticos: individual canvas pages within a project
CREATE TABLE IF NOT EXISTS scada.sinopticos (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES scada.sinoptico_projects(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    canvas JSONB NOT NULL DEFAULT '{"widgets":[],"grid":{"snap":true,"size":10},"zoom":1}',
    canvas_width INTEGER NOT NULL DEFAULT 1920,
    canvas_height INTEGER NOT NULL DEFAULT 1080,
    thumbnail TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    owner_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sinopticos_project ON scada.sinopticos(project_id);
