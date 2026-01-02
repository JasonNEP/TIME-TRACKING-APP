-- Add PIN system to user_roles table
ALTER TABLE user_roles ADD COLUMN pin_hash TEXT;

-- Update trigger to make everyone admin by default
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create table for PIN reset verification codes
CREATE TABLE pin_reset_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE pin_reset_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy for pin_reset_codes
CREATE POLICY "Users can view own codes"
  ON pin_reset_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own codes"
  ON pin_reset_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own codes"
  ON pin_reset_codes FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_pin_reset_codes_user_id ON pin_reset_codes(user_id);
CREATE INDEX idx_pin_reset_codes_expires_at ON pin_reset_codes(expires_at);

-- Function to clean up expired codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_pin_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM pin_reset_codes 
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
