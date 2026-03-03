-- 002_create_entities_table.sql
-- Creates the organizational entities hierarchy: Federal → Estatal → Municipal

CREATE TABLE IF NOT EXISTS scada.entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    level VARCHAR(20) NOT NULL CHECK (level IN ('Federal', 'Estatal', 'Municipal')),
    parent_id INTEGER REFERENCES scada.entities(id) ON DELETE SET NULL,
    estado_id INTEGER NOT NULL DEFAULT 0,
    municipio_id INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_parent ON scada.entities(parent_id);
CREATE INDEX IF NOT EXISTS idx_entities_level ON scada.entities(level);

-- Seed: CONAGUA → OCAVM/CAEM → Municipios
INSERT INTO scada.entities (id, name, level, parent_id, estado_id, municipio_id) VALUES
    (1, 'CONAGUA', 'Federal', NULL, 0, 0),
    (2, 'OCAVM', 'Estatal', 1, 15, 0),
    (3, 'CAEM', 'Estatal', 1, 15, 0),
    (4, 'Ecatepec', 'Municipal', 2, 15, 33),
    (5, 'Chalco', 'Municipal', 2, 15, 25),
    (6, 'Chicoloapan', 'Municipal', 2, 15, 28),
    (7, 'Tlalnepantla', 'Municipal', 3, 15, 104),
    (8, 'Valle de Chalco', 'Municipal', 3, 15, 122),
    (9, 'La Paz', 'Municipal', 3, 15, 70)
ON CONFLICT DO NOTHING;

-- Reset sequence to avoid conflicts with future inserts
SELECT setval('scada.entities_id_seq', (SELECT COALESCE(MAX(id), 0) FROM scada.entities));
