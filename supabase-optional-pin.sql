-- Add option to make PIN optional for admin actions

-- Add require_pin column (default to false - PIN disabled by default)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS require_pin BOOLEAN DEFAULT false;

-- Update existing users to have require_pin = false (disabled by default for better UX)
UPDATE user_roles SET require_pin = false WHERE require_pin IS NULL;
