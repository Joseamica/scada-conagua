-- Alarm definitions: threshold-based alarm rules per device/measurement
CREATE TABLE IF NOT EXISTS scada.alarms (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES scada.alarm_groups(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('aviso', 'alerta', 'critico')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    dev_eui VARCHAR(64) NOT NULL,
    measurement VARCHAR(64) NOT NULL,
    comparison_operator VARCHAR(4) NOT NULL CHECK (comparison_operator IN ('<', '>', '=', '<>')),
    threshold_value NUMERIC NOT NULL,
    hysteresis_activation_sec INTEGER NOT NULL DEFAULT 0,
    hysteresis_deactivation_sec INTEGER NOT NULL DEFAULT 0,
    action_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (action_type IN ('none', 'email', 'telegram')),
    notify_on_state_change BOOLEAN NOT NULL DEFAULT true,
    notification_template TEXT,
    resend_period_min INTEGER DEFAULT 1440,
    resend_enabled BOOLEAN NOT NULL DEFAULT false,
    created_by INTEGER REFERENCES scada.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alarms_dev_eui ON scada.alarms(dev_eui);
CREATE INDEX IF NOT EXISTS idx_alarms_enabled ON scada.alarms(is_enabled) WHERE is_enabled = true;
