-- Expand sinoptico_shares permission to support granular values (view, edit, create, delete, admin)
-- Old values 'read'/'edit' remain valid; new column allows comma-separated combos like 'edit,view'

BEGIN;

-- Drop old CHECK constraint and widen column
ALTER TABLE scada.sinoptico_shares DROP CONSTRAINT IF EXISTS sinoptico_shares_permission_check;
ALTER TABLE scada.sinoptico_shares ALTER COLUMN permission TYPE VARCHAR(50);

-- Migrate old 'read' values to 'view'
UPDATE scada.sinoptico_shares SET permission = 'view' WHERE permission = 'read';

COMMIT;
