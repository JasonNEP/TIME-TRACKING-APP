# Admin Setup & New Features

## New Features Added ✨

### 1. **User Roles (Admin vs Regular Users)**
   - Admins: Full control over all time entries
   - Regular Users: Can only clock in/out (no editing/deleting)

### 2. **Reports Page**
   - Filter by date range
   - View total hours and earnings
   - Breakdown by profile
   - Export to CSV

### 3. **Admin Features**
   - Add manual time entries for past dates
   - Edit existing time entries
   - Delete time entries
   - Admin badge in header

### 4. **Enhanced Time Entry Management**
   - Edit/delete buttons (admin only)
   - Inline editing form
   - Date/time picker for manual entries

---

## Setup Instructions

### 1. **Update Database Schema**

Run this SQL in Supabase SQL Editor:

\`\`\`sql
-- Copy and paste the contents of supabase-roles-update.sql
\`\`\`

Or manually run:
\`\`\`bash
Supabase Dashboard > SQL Editor > Paste supabase-roles-update.sql contents > Run
\`\`\`

### 2. **Set Yourself as Admin**

After creating your user account:

1. Go to Supabase Dashboard
2. Click **SQL Editor**
3. Run this query (replace YOUR_USER_ID with your actual user ID):

\`\`\`sql
-- First, find your user ID
SELECT id, email FROM auth.users;

-- Then set yourself as admin (copy your ID from above)
UPDATE user_roles SET role = 'admin' WHERE user_id = 'YOUR_USER_ID_HERE';
\`\`\`

Or use this single query:
\`\`\`sql
-- Set yourself as admin using your email
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your.email@example.com');
\`\`\`

### 3. **Restart the App**

After database changes:
1. Stop both client and server (Ctrl+C)
2. Restart:
   \`\`\`powershell
   # In server terminal
   cd "C:\\Users\\jstickney\\Documents\\VISUAL STUDIO PROJECTS\\TIME TRACKING\\server"
   npm run dev
   
   # In client terminal
   cd "C:\\Users\\jstickney\\Documents\\VISUAL STUDIO PROJECTS\\TIME TRACKING\\client"
   npm run dev
   \`\`\`

---

## Using New Features

### **For Admins:**

1. **Manual Time Entry**
   - Click "+ Add Manual Time Entry" on dashboard
   - Fill in profile, clock in/out times, and notes
   - Perfect for adding past work hours

2. **Edit Time Entries**
   - Click "Edit" button on any completed entry
   - Modify times, notes, or clock out time
   - Click "Save" to update

3. **Delete Time Entries**
   - Click "Delete" button on any entry
   - Confirm deletion

4. **View Reports**
   - Click "Reports" in header navigation
   - Select start and end dates
   - Click "Generate Report"
   - Export to CSV if needed

### **For Regular Users:**

- Can only clock in/out
- Cannot edit or delete entries
- Can view their own time entries
- Can view reports

---

## Feature Highlights

✅ **Admin Badge** - Shows in header when logged in as admin  
✅ **Protected Actions** - Edit/delete only visible to admins  
✅ **Date Range Reports** - Filter any time period  
✅ **CSV Export** - Download reports for Excel  
✅ **Manual Entry** - Add past time entries  
✅ **Inline Editing** - Edit entries without leaving page  

---

## Troubleshooting

**Q: I don't see the Admin badge**
- Make sure you ran the SQL to set yourself as admin
- Restart the client app
- Hard refresh browser (Ctrl+Shift+R)

**Q: Reports page is blank**
- Select both start and end dates
- Click "Generate Report"
- Make sure you have time entries in that date range

**Q: Can't edit entries**
- Only completed entries (with clock out time) can be edited
- Only admins can edit
- Check that you're set as admin in database

---

## Next Steps

Consider adding:
- [ ] Multi-user support (admins see all users)
- [ ] Email notifications for clock in/out
- [ ] Weekly/monthly automatic reports
- [ ] Break time tracking
- [ ] Project/task categories
- [ ] Invoice generation

Enjoy your enhanced time tracker! 🎉
