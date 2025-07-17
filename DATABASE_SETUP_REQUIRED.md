# 🚨 Database Setup Required

## Issue
The connection request system requires database tables that haven't been created yet.

## Error Details
- `connection_requests` table doesn't exist (causing 406 errors)
- `notifications` table needs additional columns for connection requests

## Solution
You need to run the SQL setup script in your Supabase dashboard:

### Steps:
1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Run the SQL Script**
   - Copy the contents of `create_connection_system.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute

3. **Test the Connection System**
   - Once the script runs successfully, the Connect button will work
   - Suppliers will receive notifications with Accept/Decline buttons
   - Connected suppliers will appear in My Team

## File Location
The SQL script is located at: `/create_connection_system.sql`

## After Setup
The complete connection request workflow will be functional:
- Event organizers can send connection requests
- Suppliers receive actionable notifications  
- Accepted connections are tracked and displayed in My Team
