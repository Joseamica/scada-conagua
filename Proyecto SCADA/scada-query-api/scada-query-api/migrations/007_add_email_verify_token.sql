-- 007: Add email_verify_token column for magic link verification
ALTER TABLE scada.users ADD COLUMN IF NOT EXISTS email_verify_token VARCHAR(255);
