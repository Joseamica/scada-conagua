-- Add render_url column to inventory table for uploaded site render images
-- Stores the relative URL path (e.g. /api/v1/uploads/renders/abc123.png)

ALTER TABLE scada.inventory
  ADD COLUMN IF NOT EXISTS render_url VARCHAR(255);
