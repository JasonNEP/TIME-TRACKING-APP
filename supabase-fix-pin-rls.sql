-- Fix RLS policies for PIN updates
-- Run this in Supabase SQL Editor if PIN updates aren't working

-- First, check if the policy exists
SELECT * FROM pg_policies WHERE tablename = 'user_roles';

-- Drop existing update policy if it's too restrictive
DROP POLICY IF EXISTS "Users can update own role" ON user_roles;

-- Create a new policy that allows users to update their own pin_hash
CREATE POLICY "Users can update own pin_hash" ON user_roles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verify the column exists and can accept text
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_roles' AND column_name = 'pin_hash';

-- Check if there's a user_roles entry for your user
-- Replace 'your-email@example.com' with your actual email
SELECT ur.* 
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'your-email@example.com';

-- If no entry exists, this might be the issue
-- The trigger should create it, but let's verify
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
