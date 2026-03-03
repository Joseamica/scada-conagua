-- 001_add_totp_columns.sql
-- Adds Google Authenticator (TOTP) support to scada.users
-- Date: 2026-02-25

ALTER TABLE scada.users
    ADD COLUMN IF NOT EXISTS totp_secret TEXT,
    ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN scada.users.totp_secret  IS 'Base32-encoded secret for Google Authenticator TOTP';
COMMENT ON COLUMN scada.users.totp_enabled IS 'Whether TOTP 2FA is active for this user';
