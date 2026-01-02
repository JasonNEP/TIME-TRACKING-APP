# PIN System Setup Instructions

## 1. Update Database Schema

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste the contents from `supabase-pin-system.sql`
6. Click "Run" to execute the SQL

This will:
- Add `pin_hash` column to `user_roles` table
- Update the trigger to make all new users admins by default
- Create `pin_reset_codes` table for email-based PIN recovery
- Set up RLS policies for security
- Create a cleanup function for expired codes

## 2. How the PIN System Works

### First Time Setup
- When a user signs in for the first time (or if they don't have a PIN), they'll be prompted to set a 4-digit PIN
- The PIN is hashed using SHA-256 before storing (more secure than plaintext)
- This happens automatically on the Dashboard page

### Admin Actions Requiring PIN
The following actions now require PIN verification:
- **Manual Entry**: Adding a manual time entry
- **Edit Time Entry**: Modifying an existing time entry
- **Delete Time Entry**: Removing a time entry
- **Add Profile**: Creating a new work profile
- **Edit Profile**: Modifying profile name or rate
- **Delete Profile**: Removing a profile

### PIN Management
Users can manage their PIN from the Settings page:
1. **Change PIN**: Requires current PIN, then set new PIN
2. **Forgot PIN**: Request reset code via email

### PIN Reset Process
1. User clicks "Reset PIN via Email" in Settings
2. System generates a 6-digit verification code
3. Code is valid for 15 minutes
4. User enters code + new PIN to reset
5. Code becomes invalid after use

**Note**: For demo purposes, the reset code is currently shown in an alert. In production, you'd need to implement email sending via:
- Supabase Edge Functions
- Your backend server with email service (SendGrid, AWS SES, etc.)
- Third-party email API

## 3. Security Features

- PINs are hashed (not stored as plaintext)
- Reset codes expire after 15 minutes
- Used reset codes can't be reused
- Row Level Security (RLS) ensures users can only access their own data
- All admin actions protected with PIN verification

## 4. Testing the System

1. Sign in to your app
2. You'll be prompted to set a PIN (any 4 digits)
3. Try to perform admin actions - you'll need to enter your PIN
4. Test PIN change in Settings
5. Test PIN reset (for demo, code appears in alert)

## 5. Production Recommendations

Before going live, consider:
1. Implement proper email sending for PIN reset codes
2. Add rate limiting to prevent PIN brute-force attacks
3. Consider using bcrypt instead of SHA-256 for stronger hashing
4. Add PIN attempt limits (lock after N failed attempts)
5. Log PIN changes for audit trail
6. Add 2FA for extra security (optional)

## 6. Default Behavior

- All users are now admins by default (as requested)
- PIN is required for all administrative functions
- Regular clock in/out doesn't require PIN
- Viewing reports doesn't require PIN
