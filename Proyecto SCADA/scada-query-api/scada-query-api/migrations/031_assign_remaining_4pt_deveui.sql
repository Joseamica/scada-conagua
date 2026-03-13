-- Migration 031: Assign real DevEUI to remaining 4PT sites from Mapeo_Sitios_SCADA.xlsx
-- 9 placeholder updates + 4 new inserts for devices not in migration 029

BEGIN;

-- === 9 UPDATEs: vincular devEUI real a placeholder existente ===

UPDATE scada.inventory SET dev_eui = '24e124445e280805', gw_eui = '7076ff008101039f'
WHERE TRIM(dev_eui) = 'pend000000000012'; -- POZO HEROES V (Chalco)

UPDATE scada.inventory SET dev_eui = '24e124445e281856', gw_eui = '7076ff0081010676'
WHERE TRIM(dev_eui) = 'pend000000000058'; -- POZO 324 FOVISSSTE (Ecatepec)

UPDATE scada.inventory SET dev_eui = '24e124445e218277', gw_eui = '7076ff0081010682'
WHERE TRIM(dev_eui) = 'pend000000000074'; -- POZO IZCALLI JARDINES (Ecatepec)

UPDATE scada.inventory SET dev_eui = '24e124445e217673', gw_eui = '7076ff0081010492'
WHERE TRIM(dev_eui) = 'pend000000000065'; -- POZO 351 PALOMAS (Ecatepec)

UPDATE scada.inventory SET dev_eui = '24e124445e280130', gw_eui = '7076ff0081010380'
WHERE TRIM(dev_eui) = 'pend000000000050'; -- POZO 306 NICOLAS BRAVO I (Ecatepec)

UPDATE scada.inventory SET dev_eui = '24e124445e281606', gw_eui = '7076ff00810104fe'
WHERE TRIM(dev_eui) = 'pend000000000048'; -- POZO 304 CENTRAL I (Ecatepec)

UPDATE scada.inventory SET dev_eui = '24e124445e280454', gw_eui = '7076ff0081010385'
WHERE TRIM(dev_eui) = 'pend000000000045'; -- POZO 27 PROGRESO (Ecatepec)

UPDATE scada.inventory SET dev_eui = '24e124445e280260', gw_eui = '7076ff008101050d'
WHERE TRIM(dev_eui) = 'pend000000000081'; -- POZO VENTA DE PUERCOS (Ecatepec)

-- === 4 INSERTs: sites not in migration 029 ===

INSERT INTO scada.inventory (dev_eui, gw_eui, site_name, site_type, municipality, estatus, proveedor, is_active)
VALUES ('24e124445e218271', '7076ff0081010505', 'Pozo Heroes II - Ecatepec', 'pozo', 'Ecatepec', 'pendiente', '4PT', true)
ON CONFLICT (dev_eui) DO NOTHING;

INSERT INTO scada.inventory (dev_eui, gw_eui, site_name, site_type, municipality, estatus, proveedor, is_active)
VALUES ('24e124445e218468', '7076ff00810104ea', 'Pozo Heroes III - Ecatepec', 'pozo', 'Ecatepec', 'pendiente', '4PT', true)
ON CONFLICT (dev_eui) DO NOTHING;

INSERT INTO scada.inventory (dev_eui, gw_eui, site_name, site_type, municipality, latitude, longitude, estatus, proveedor, is_active)
VALUES ('24e124445e280677', '7076ff0081010263', 'Pozo Jardines de Casa Nueva II', 'pozo', 'Ecatepec', 19.549344, -99.043052, 'pendiente', '4PT', true)
ON CONFLICT (dev_eui) DO NOTHING;

INSERT INTO scada.inventory (dev_eui, gw_eui, site_name, site_type, municipality, estatus, proveedor, is_active)
VALUES ('24e124445e280224', '7076ff0081010485', 'Pozo Nicolas Bravo II', 'pozo', 'Ecatepec', 'pendiente', '4PT', true)
ON CONFLICT (dev_eui) DO NOTHING;

COMMIT;
