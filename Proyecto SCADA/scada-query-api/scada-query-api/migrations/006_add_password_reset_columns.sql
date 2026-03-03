-- 006: Add password reset token columns for self-service forgot password
-- The token itself is stored as a SHA-256 hash (never plaintext) so even
-- a DB leak cannot be used to forge reset links.

ALTER TABLE scada.users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64);
ALTER TABLE scada.users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;
