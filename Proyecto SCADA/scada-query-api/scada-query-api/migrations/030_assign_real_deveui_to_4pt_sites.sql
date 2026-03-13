-- Migration 030: Assign real DevEUI to 10 4PT sites transmitting as SITIO_DESCONOCIDO
-- These devices are already in ChirpStack and transmitting, but inventory had placeholder devEUIs.
-- Data from Excel provided by field team (March 13, 2026).

BEGIN;

-- 1. La Veleta: device replacement (old 24e124445e281357 → new 24e124445e216955)
UPDATE scada.inventory
SET dev_eui = '24e124445e216955'
WHERE dev_eui = '24e124445e281357';

-- Clean old device's site_status (no longer transmitting)
DELETE FROM scada.site_status WHERE dev_eui = '24e124445e281357';

-- 2. Update 9 placeholder devEUIs to real ones
UPDATE scada.inventory SET dev_eui = '24e124445e286439'
WHERE TRIM(dev_eui) = 'pend000000000080'; -- POZO TANQUE LA PRADERA

UPDATE scada.inventory SET dev_eui = '24e124445e280662'
WHERE TRIM(dev_eui) = 'pend000000000011'; -- POZO HEROES IV

UPDATE scada.inventory SET dev_eui = '24e124445e282135'
WHERE TRIM(dev_eui) = 'pend000000000078'; -- POZO POTRERO DEL REY 4T

UPDATE scada.inventory SET dev_eui = '24e124445e218718'
WHERE TRIM(dev_eui) = 'pend000000000008'; -- POZO HEROES I

UPDATE scada.inventory SET dev_eui = '24e124445e217035'
WHERE TRIM(dev_eui) = 'pend000000000010'; -- POZO HEROES III

UPDATE scada.inventory SET dev_eui = '24e124445e281573'
WHERE TRIM(dev_eui) = 'pend000000000055'; -- POZO 316 GLORIETA DE CIRCUNVALACIÓN

UPDATE scada.inventory SET dev_eui = '24e124445e217388'
WHERE TRIM(dev_eui) = 'pend000000000064'; -- POZO 35 BONITO ECATEPEC

UPDATE scada.inventory SET dev_eui = '24e124445e218815'
WHERE TRIM(dev_eui) = 'pend000000000009'; -- POZO HEROES II

UPDATE scada.inventory SET dev_eui = '24e124445e218422'
WHERE TRIM(dev_eui) = 'pend000000000063'; -- POZO 349 PRADOS SANTA CLARA

COMMIT;
