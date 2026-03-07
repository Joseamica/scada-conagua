-- Soporte para sensores de nivel de agua (tanque/drenaje) y pluviometros
ALTER TABLE scada.site_status
  ADD COLUMN IF NOT EXISTS last_nivel_value NUMERIC,
  ADD COLUMN IF NOT EXISTS last_lluvia_value NUMERIC;
