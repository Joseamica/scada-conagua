-- Variable system: folders, views, and columns for tag browsing and aggregation
CREATE TABLE IF NOT EXISTS scada.variable_folders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES scada.variable_folders(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scada.variable_views (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    folder_id INTEGER REFERENCES scada.variable_folders(id) ON DELETE SET NULL,
    owner_id INTEGER NOT NULL REFERENCES scada.users(id) ON DELETE CASCADE,
    is_shared BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scada.view_columns (
    id SERIAL PRIMARY KEY,
    view_id INTEGER NOT NULL REFERENCES scada.variable_views(id) ON DELETE CASCADE,
    alias VARCHAR(100) NOT NULL,
    dev_eui VARCHAR(64) NOT NULL,
    measurement VARCHAR(64) NOT NULL,
    aggregation VARCHAR(20) NOT NULL DEFAULT 'AVG'
        CHECK (aggregation IN ('AVG','MIN','MAX','SUM','LAST_VALUE','BAL')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
