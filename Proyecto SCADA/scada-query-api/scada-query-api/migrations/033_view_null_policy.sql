-- Add null_policy to variable_views for controlling how null values are handled in formulas
-- 'zero' = substitute null with 0 (professional SCADA default — Ignition, AVEVA, WinCC behavior)
-- 'null' = propagate null (strict mode — if any input is null, formula result is null)
ALTER TABLE scada.variable_views
ADD COLUMN IF NOT EXISTS null_policy VARCHAR(10) NOT NULL DEFAULT 'zero';
