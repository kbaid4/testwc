-- Migration: Fix admin company names by copying full_name to company_name where NULL

-- First, try to get company_name from auth.users metadata for admin users
UPDATE profiles 
SET company_name = (
  SELECT (raw_user_meta_data->>'companyname')::text 
  FROM auth.users 
  WHERE auth.users.id = profiles.id
)
WHERE user_type = 'admin' 
  AND company_name IS NULL 
  AND EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = profiles.id 
    AND raw_user_meta_data->>'companyname' IS NOT NULL
  );

-- Update admin profiles to set company_name = full_name where company_name is still NULL
UPDATE profiles 
SET company_name = full_name 
WHERE user_type = 'admin' 
  AND company_name IS NULL 
  AND full_name IS NOT NULL;

-- For admin profiles where both company_name and full_name are NULL, set a default
UPDATE profiles 
SET company_name = 'Event Organizer' 
WHERE user_type = 'admin' 
  AND company_name IS NULL 
  AND full_name IS NULL;

-- Add a comment to document this fix
COMMENT ON COLUMN profiles.company_name IS 'Company name for suppliers, organization name for admins'; 