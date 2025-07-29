-- Migration: Ensure planners & liaisons tables have admin_email column (used by frontend)
 
ALTER TABLE planners  ADD COLUMN IF NOT EXISTS admin_email text;
ALTER TABLE liaisons ADD COLUMN IF NOT EXISTS admin_email text; 