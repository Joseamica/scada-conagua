-- Alarm runtime state (1:1 with alarms) and historical log (5yr retention)
CREATE TABLE IF NOT EXISTS scada.alarm_state (
    id SERIAL PRIMARY KEY,
    alarm_id INTEGER NOT NULL UNIQUE REFERENCES scada.alarms(id) ON DELETE CASCADE,
    current_state VARCHAR(30) NOT NULL DEFAULT 'INACTIVE'
        CHECK (current_state IN ('INACTIVE','PENDING_ACTIVATION','ACTIVE_UNACK','ACTIVE_ACK','PENDING_DEACTIVATION')),
    condition_met_since TIMESTAMPTZ,
    condition_cleared_since TIMESTAMPTZ,
    last_evaluated_at TIMESTAMPTZ,
    last_triggered_at TIMESTAMPTZ,
    last_notification_sent_at TIMESTAMPTZ,
    last_value NUMERIC,
    acknowledged_by INTEGER REFERENCES scada.users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    ack_comment TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scada.alarm_history (
    id SERIAL PRIMARY KEY,
    alarm_id INTEGER REFERENCES scada.alarms(id) ON DELETE SET NULL,
    alarm_name VARCHAR(200),
    dev_eui VARCHAR(64),
    group_name VARCHAR(200),
    severity VARCHAR(20),
    previous_state VARCHAR(30) NOT NULL,
    new_state VARCHAR(30) NOT NULL,
    trigger_value NUMERIC,
    threshold_value NUMERIC,
    transition_reason TEXT,
    user_id INTEGER REFERENCES scada.users(id) ON DELETE SET NULL,
    ack_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alarm_history_created ON scada.alarm_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alarm_history_dev_eui ON scada.alarm_history(dev_eui);
