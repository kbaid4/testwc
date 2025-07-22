-- Migration: Add missing profile fields for supplier profiles

-- Add description column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS description text;

-- Add promotions column as JSONB to store promotion data
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS promotions jsonb;

-- Add address column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address text;

-- Add company_name column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS company_name text;

-- Add full_name column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name text;

-- Add updated_at column with trigger
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 