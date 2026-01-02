# PIN Reset Instructions

## If Your PIN Isn't Working

### Option 1: Check Browser Console for Debug Info
1. Open your app
2. Press F12 to open Developer Tools
3. Go to the "Console" tab
4. Try entering your PIN
5. Look for these logs:
   - "Stored PIN hash: [hash]"
   - "Entered PIN hash: [hash]"
   - "Match: true/false"

If the hashes don't match, your PIN may have been saved incorrectly.

### Option 2: Reset PIN Directly in Database
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click "Table Editor" in the sidebar
4. Select the `user_roles` table
5. Find your user row
6. Click on the `pin_hash` cell
7. Set it to `null` (empty)
8. Save
9. Refresh your app - you'll be prompted to set a new PIN

### Option 3: Use Settings Page
1. In your app, click the "Settings" button in the top navigation
2. Or navigate to: [your-app-url]/settings
3. Scroll down to "Forgot PIN?"
4. Click "Reset PIN via Email"
5. Follow the reset process

### Option 4: SQL Reset Query
Run this in Supabase SQL Editor (replace with your email):

```sql
UPDATE user_roles
SET pin_hash = NULL
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

Then refresh your app to set a new PIN.

## Forgot PIN Link
A "Forgot PIN?" link now appears on the PIN verification modal that takes you directly to Settings.

## Troubleshooting

**Problem**: "Incorrect PIN" error
**Solution**: Check console logs to see if hashes match. If not, reset using Option 2 above.

**Problem**: Can't access Settings
**Solution**: The Settings button is in the top navigation bar. Or type `/settings` at the end of your app URL.

**Problem**: PIN reset email not sending
**Solution**: For now, reset codes appear in an alert popup (demo mode). Check the alert when you request a reset.
