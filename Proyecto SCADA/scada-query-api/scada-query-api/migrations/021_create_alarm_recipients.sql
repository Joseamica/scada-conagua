-- Alarm notification recipients and collections
CREATE TABLE IF NOT EXISTS scada.alarm_recipients (
    id SERIAL PRIMARY KEY,
    contact_name VARCHAR(200) NOT NULL,
    email VARCHAR(254),
    phone VARCHAR(30),
    telegram_username VARCHAR(100),
    telegram_chat_id VARCHAR(50),
    telegram_enabled BOOLEAN NOT NULL DEFAULT false,
    comments TEXT,
    created_by INTEGER REFERENCES scada.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scada.alarm_recipient_collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES scada.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scada.alarm_collection_members (
    collection_id INTEGER NOT NULL REFERENCES scada.alarm_recipient_collections(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES scada.alarm_recipients(id) ON DELETE CASCADE,
    PRIMARY KEY (collection_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS scada.alarm_group_recipients (
    group_id INTEGER NOT NULL REFERENCES scada.alarm_groups(id) ON DELETE CASCADE,
    collection_id INTEGER NOT NULL REFERENCES scada.alarm_recipient_collections(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, collection_id)
);
