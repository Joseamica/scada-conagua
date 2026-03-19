-- 039: Add canvas_bg column to scada.sinopticos
-- Stores the canvas background color (CSS color string, e.g. '#ffffff' or 'transparent')
ALTER TABLE scada.sinopticos
    ADD COLUMN IF NOT EXISTS canvas_bg VARCHAR(50) DEFAULT '#ffffff';
