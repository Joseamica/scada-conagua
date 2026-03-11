-- Migration 026: Add Ixtapaluca entity and missing inventory sites
-- Resolves observations from Anibal's Reporte_Ixtapaluca_SOA (10/03/2026)

BEGIN;

-- 1. Create Ixtapaluca entity (municipio_id=39 = CVE_MUN INEGI)
INSERT INTO scada.entities (name, level, parent_id, municipio_id)
SELECT 'Ixtapaluca', 'Municipal', 2, 39
WHERE NOT EXISTS (
    SELECT 1 FROM scada.entities WHERE municipio_id = 39 AND level = 'Municipal'
);

-- 2. Insert 6 missing Ixtapaluca pozos into inventory
-- These exist in the frontend (POZOS_DATA) but were missing from DB
-- devEUI and coordinates from POZOS_DATA; estatus from Anibal's report

INSERT INTO scada.inventory (gw_eui, dev_eui, site_name, site_type, municipality, latitude, longitude, proveedor, estatus, is_active)
SELECT * FROM (VALUES
    ('gw00000000000005', 'dev0000000000005', 'POZO 05', 'Pozo', 'IXTAPALUCA', 19.32239305731164, -98.88946433949809, 'ICH', 'obra',   true),
    ('gw00000000000013', 'dev0000000000013', 'POZO 13', 'Pozo', 'IXTAPALUCA', 19.29541837527117, -98.88645390334638, 'ICH', 'obra',   true),
    ('gw00000000000016', 'dev0000000000016', 'POZO 16', 'Pozo', 'IXTAPALUCA', 19.33432577592962, -98.94470506895368, 'ICH', 'activo', true),
    ('gw00000000000021', 'dev0000000000021', 'POZO 21', 'Pozo', 'IXTAPALUCA', 19.32364785186973, -98.87981993461943, 'ICH', 'activo', true),
    ('gw00000000000030', 'dev0000000000030', 'POZO 30', 'Pozo', 'IXTAPALUCA', 19.30509519080447, -98.86636257998913, 'ICH', 'activo', true),
    ('gw00000000000036', 'dev0000000000036', 'POZO 36', 'Pozo', 'IXTAPALUCA', 19.30870385803725, -98.89395572551975, 'ICH', 'activo', true)
) AS new_sites(gw_eui, dev_eui, site_name, site_type, municipality, latitude, longitude, proveedor, estatus, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM scada.inventory WHERE TRIM(dev_eui) = new_sites.dev_eui
);

COMMIT;
