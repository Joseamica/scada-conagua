-- Formulas and sharing for variable views
CREATE TABLE IF NOT EXISTS scada.view_formulas (
    id SERIAL PRIMARY KEY,
    view_id INTEGER NOT NULL REFERENCES scada.variable_views(id) ON DELETE CASCADE,
    alias VARCHAR(100) NOT NULL,
    expression TEXT NOT NULL,
    depends_on INTEGER[] NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scada.view_shares (
    id SERIAL PRIMARY KEY,
    view_id INTEGER NOT NULL REFERENCES scada.variable_views(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    permission VARCHAR(10) NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'edit')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(view_id, user_id)
);
