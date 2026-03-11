-- Migration 028: Add play_sound and show_banner columns to alarms table
-- Configurable per alarm: sound plays on activation, banner shows persistent alert

ALTER TABLE scada.alarms ADD COLUMN IF NOT EXISTS play_sound BOOLEAN DEFAULT false;
ALTER TABLE scada.alarms ADD COLUMN IF NOT EXISTS show_banner BOOLEAN DEFAULT false;

COMMENT ON COLUMN scada.alarms.play_sound IS 'When true, plays audible alert on alarm activation (ACTIVE_UNACK)';
COMMENT ON COLUMN scada.alarms.show_banner IS 'When true, shows persistent full-width banner while alarm is active';
