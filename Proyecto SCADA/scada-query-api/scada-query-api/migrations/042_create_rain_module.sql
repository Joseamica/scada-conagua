BEGIN;

-- Rain stations (pluviometers)
CREATE TABLE IF NOT EXISTS scada.rain_stations (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    address TEXT,
    municipality VARCHAR(100),
    municipio_id INTEGER DEFAULT 0,
    latitude NUMERIC(10,6) NOT NULL,
    longitude NUMERIC(10,6) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_value_mm NUMERIC(8,2) DEFAULT 0,
    last_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rain_stations_municipio ON scada.rain_stations(municipio_id);

-- Daily rain cuts (6AM-6AM, one row per station per day)
CREATE TABLE IF NOT EXISTS scada.rain_daily_cuts (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES scada.rain_stations(id) ON DELETE CASCADE,
    cut_date DATE NOT NULL,
    h06 NUMERIC(6,2) DEFAULT 0, h07 NUMERIC(6,2) DEFAULT 0,
    h08 NUMERIC(6,2) DEFAULT 0, h09 NUMERIC(6,2) DEFAULT 0,
    h10 NUMERIC(6,2) DEFAULT 0, h11 NUMERIC(6,2) DEFAULT 0,
    h12 NUMERIC(6,2) DEFAULT 0, h13 NUMERIC(6,2) DEFAULT 0,
    h14 NUMERIC(6,2) DEFAULT 0, h15 NUMERIC(6,2) DEFAULT 0,
    h16 NUMERIC(6,2) DEFAULT 0, h17 NUMERIC(6,2) DEFAULT 0,
    h18 NUMERIC(6,2) DEFAULT 0, h19 NUMERIC(6,2) DEFAULT 0,
    h20 NUMERIC(6,2) DEFAULT 0, h21 NUMERIC(6,2) DEFAULT 0,
    h22 NUMERIC(6,2) DEFAULT 0, h23 NUMERIC(6,2) DEFAULT 0,
    h00 NUMERIC(6,2) DEFAULT 0, h01 NUMERIC(6,2) DEFAULT 0,
    h02 NUMERIC(6,2) DEFAULT 0, h03 NUMERIC(6,2) DEFAULT 0,
    h04 NUMERIC(6,2) DEFAULT 0, h05 NUMERIC(6,2) DEFAULT 0,
    cut_total NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(station_id, cut_date)
);

CREATE INDEX IF NOT EXISTS idx_rain_cuts_date ON scada.rain_daily_cuts(cut_date);
CREATE INDEX IF NOT EXISTS idx_rain_cuts_station ON scada.rain_daily_cuts(station_id);

-- Seed 20 mock pluviometer stations across EDOMEX municipalities
INSERT INTO scada.rain_stations (code, name, address, municipality, municipio_id, latitude, longitude) VALUES
('P001', 'Pluvio Ecatepec Centro', 'Av. Central, Col. Centro', 'Ecatepec', 33, 19.6011, -99.0500),
('P002', 'Pluvio Ecatepec Norte', 'Blvd. Valle de Ecatepec', 'Ecatepec', 33, 19.6200, -99.0300),
('P003', 'Pluvio Chalco Centro', 'Av. Cuauhtémoc, Col. Centro', 'Chalco', 25, 19.2630, -98.8970),
('P004', 'Pluvio Chalco Sur', 'Carr. Federal México-Cuautla', 'Chalco', 25, 19.2400, -98.8800),
('P005', 'Pluvio Chicoloapan', 'Av. Benito Juárez', 'Chicoloapan', 29, 19.4130, -98.9010),
('P006', 'Pluvio Chimalhuacán', 'Av. Nezahualcóyotl', 'Chimalhuacán', 31, 19.4300, -98.9500),
('P007', 'Pluvio Ixtapaluca Centro', 'Carr. Federal México-Puebla', 'Ixtapaluca', 39, 19.3180, -98.8820),
('P008', 'Pluvio Ixtapaluca Norte', 'Col. San Francisco', 'Ixtapaluca', 39, 19.3400, -98.8700),
('P009', 'Pluvio La Paz', 'Av. Central, Los Reyes', 'La Paz', 70, 19.3630, -98.9440),
('P010', 'Pluvio Neza Centro', 'Av. Chimalhuacán', 'Nezahualcóyotl', 58, 19.4000, -99.0200),
('P011', 'Pluvio Neza Sur', 'Bordo de Xochiaca', 'Nezahualcóyotl', 58, 19.3800, -99.0100),
('P012', 'Pluvio Texcoco', 'Fray Pedro de Gante', 'Texcoco', 99, 19.5120, -98.8820),
('P013', 'Pluvio Tlalnepantla', 'Av. Mario Colín', 'Tlalnepantla', 104, 19.5400, -99.2000),
('P014', 'Pluvio Valle de Chalco', 'Av. Tláhuac-Chalco', 'Valle de Chalco', 122, 19.2820, -98.9370),
('P015', 'Pluvio Ecatepec Sur', 'Av. Central esq. Vía Morelos', 'Ecatepec', 33, 19.5700, -99.0600),
('P016', 'Pluvio Chalco Oriente', 'San Martín Cuautlalpan', 'Chalco', 25, 19.2700, -98.8600),
('P017', 'Pluvio Chicoloapan Sur', 'San Vicente Chicoloapan', 'Chicoloapan', 29, 19.3900, -98.9100),
('P018', 'Pluvio Ixtapaluca Sur', 'Coatepec', 'Ixtapaluca', 39, 19.2900, -98.8500),
('P019', 'Pluvio Texcoco Norte', 'San Miguel Tlaixpan', 'Texcoco', 99, 19.5300, -98.8500),
('P020', 'Pluvio Tlalnepantla Sur', 'San Bartolo Tenayuca', 'Tlalnepantla', 104, 19.5200, -99.1800)
ON CONFLICT (code) DO NOTHING;

-- Seed 7 days of mock daily cuts with realistic rainfall patterns
-- Day 1 (today): light rain in a few stations
INSERT INTO scada.rain_daily_cuts (station_id, cut_date, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23, h00, h01, h02, h03, h04, h05, cut_total)
SELECT s.id, CURRENT_DATE,
  0, 0, 0, 0, 0, 0, 0,
  CASE WHEN s.id % 5 = 0 THEN 0.25 ELSE 0 END,
  CASE WHEN s.id % 3 = 0 THEN 0.50 ELSE 0 END,
  CASE WHEN s.id % 4 = 0 THEN 0.75 ELSE 0 END,
  CASE WHEN s.id % 2 = 0 THEN 0.25 ELSE 0 END,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  CASE WHEN s.id % 2 = 0 THEN 1.00
       WHEN s.id % 3 = 0 THEN 0.50
       WHEN s.id % 5 = 0 THEN 0.25
       ELSE 0 END
FROM scada.rain_stations s
ON CONFLICT (station_id, cut_date) DO NOTHING;

-- Day 2 (yesterday): moderate rain afternoon
INSERT INTO scada.rain_daily_cuts (station_id, cut_date, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23, h00, h01, h02, h03, h04, h05, cut_total)
SELECT s.id, CURRENT_DATE - 1,
  0, 0, 0, 0, 0, 0, 0, 0,
  CASE WHEN s.id <= 10 THEN 1.25 ELSE 0 END,
  CASE WHEN s.id <= 10 THEN 2.50 ELSE 0.25 END,
  CASE WHEN s.id <= 15 THEN 3.75 ELSE 0.50 END,
  CASE WHEN s.id <= 15 THEN 2.00 ELSE 0.25 END,
  CASE WHEN s.id <= 10 THEN 0.50 ELSE 0 END,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  CASE WHEN s.id <= 10 THEN 10.00
       WHEN s.id <= 15 THEN 4.75
       ELSE 0.75 END
FROM scada.rain_stations s
ON CONFLICT (station_id, cut_date) DO NOTHING;

-- Day 3: heavy rain (tormenta)
INSERT INTO scada.rain_daily_cuts (station_id, cut_date, h06, h07, h08, h09, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19, h20, h21, h22, h23, h00, h01, h02, h03, h04, h05, cut_total)
SELECT s.id, CURRENT_DATE - 2,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  CASE WHEN s.id % 2 = 0 THEN 5.00 ELSE 2.50 END,
  CASE WHEN s.id % 2 = 0 THEN 8.50 ELSE 4.25 END,
  CASE WHEN s.id % 2 = 0 THEN 12.00 ELSE 6.00 END,
  CASE WHEN s.id % 2 = 0 THEN 7.50 ELSE 3.75 END,
  CASE WHEN s.id % 2 = 0 THEN 3.00 ELSE 1.50 END,
  CASE WHEN s.id % 3 = 0 THEN 1.00 ELSE 0.50 END,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  CASE WHEN s.id % 2 = 0 THEN 36.00
       ELSE 18.50 END
FROM scada.rain_stations s
ON CONFLICT (station_id, cut_date) DO NOTHING;

-- Days 4-7: dry days (no rain)
INSERT INTO scada.rain_daily_cuts (station_id, cut_date, cut_total)
SELECT s.id, d.dt, 0
FROM scada.rain_stations s
CROSS JOIN (VALUES (CURRENT_DATE - 3), (CURRENT_DATE - 4), (CURRENT_DATE - 5), (CURRENT_DATE - 6)) AS d(dt)
ON CONFLICT (station_id, cut_date) DO NOTHING;

-- Update last_value_mm for today's active stations
UPDATE scada.rain_stations SET
  last_value_mm = CASE
    WHEN id % 5 = 0 THEN 0.25
    WHEN id % 3 = 0 THEN 0.50
    WHEN id % 2 = 0 THEN 0.75
    ELSE 0 END,
  last_updated_at = NOW() - (random() * interval '30 minutes');

COMMIT;
