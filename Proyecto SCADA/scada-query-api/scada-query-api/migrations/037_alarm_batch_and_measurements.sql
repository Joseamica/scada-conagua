-- 037: Add batch_id to alarms for multi-site creation + measurement catalog
-- batch_id to group alarms created together (multi-site)
ALTER TABLE scada.alarms ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_alarms_batch ON scada.alarms(batch_id) WHERE batch_id IS NOT NULL;

-- Measurement catalog (static, seeded)
CREATE TABLE IF NOT EXISTS scada.measurement_catalog (
    id SERIAL PRIMARY KEY,
    key VARCHAR(64) NOT NULL,
    label VARCHAR(100) NOT NULL,
    unit VARCHAR(20),
    category VARCHAR(50) DEFAULT 'general',
    provider VARCHAR(20) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

INSERT INTO scada.measurement_catalog (key, label, unit, provider, sort_order) VALUES
('caudal_lts', 'Caudal', 'L/s', '4PT', 1),
('presion_kg', 'Presion', 'kg/cm2', '4PT', 2),
('battery', 'Bateria', '%', '4PT', 3),
('rssi', 'Senal RSSI', 'dBm', '4PT', 4),
('snr', 'Senal SNR', 'dB', '4PT', 5),
('value_caudal', 'Caudal', 'L/s', 'ICH', 1),
('value_presion', 'Presion', 'kg/cm2', 'ICH', 2),
('value_caudal_totalizado', 'Caudal Totalizado', 'm3', 'ICH', 3),
('value_nivel', 'Nivel', 'm', 'ICH', 4),
('value_lluvia', 'Lluvia', 'mm', 'ICH', 5),
('value_senal', 'Senal', 'dBm', 'ICH', 6)
ON CONFLICT DO NOTHING;
