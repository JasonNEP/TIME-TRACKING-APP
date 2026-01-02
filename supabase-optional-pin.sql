-- Add option to make PIN optional for admin actions

-- Add require_pin column (default to true for security)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS require_pin BOOLEAN DEFAULT true;

-- Update existing users to have require_pin = true
UPDATE user_roles SET require_pin = true WHERE require_pin IS NULL;
