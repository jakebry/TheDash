/*
  # Add Profile Name Columns to Business Tables

  1. Changes
    - Add profile_name column to business_members and business_user_roles
    - Update existing records with profile names
    - Add triggers to maintain profile names
    - Add indexes for efficient querying
    
  2. Security
    - Maintain existing security policies
    - Use SECURITY DEFINER for elevated privileges
*/

-- Add profile_name columns
ALTER TABLE business_members 
ADD COLUMN IF NOT EXISTS profile_name VARCHAR;

ALTER TABLE business_user_roles 
ADD COLUMN IF NOT EXISTS profile_name VARCHAR;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_business_members_profile_name 
ON business_members(profile_name);

CREATE INDEX IF NOT EXISTS idx_business_user_roles_profile_name 
ON business_user_roles(profile_name);

-- Create function to get profile name
CREATE OR REPLACE FUNCTION get_profile_name(user_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_name VARCHAR;
BEGIN
  SELECT COALESCE(full_name, email, 'Unknown User')
  INTO profile_name
  FROM profiles
  WHERE id = user_id;
  
  RETURN COALESCE(profile_name, 'Unknown User');
END;
$$;

-- Create trigger function for business_members
CREATE OR REPLACE FUNCTION set_business_member_profile_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.profile_name := get_profile_name(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Create trigger function for business_user_roles
CREATE OR REPLACE FUNCTION set_business_role_profile_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.profile_name := get_profile_name(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS set_business_member_profile_name_trigger ON business_members;
CREATE TRIGGER set_business_member_profile_name_trigger
  BEFORE INSERT OR UPDATE OF user_id ON business_members
  FOR EACH ROW
  EXECUTE FUNCTION set_business_member_profile_name();

DROP TRIGGER IF EXISTS set_business_role_profile_name_trigger ON business_user_roles;
CREATE TRIGGER set_business_role_profile_name_trigger
  BEFORE INSERT OR UPDATE OF user_id ON business_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION set_business_role_profile_name();

-- Update existing records with profile names
UPDATE business_members bm
SET profile_name = get_profile_name(bm.user_id)
WHERE bm.profile_name IS NULL;

UPDATE business_user_roles bur
SET profile_name = get_profile_name(bur.user_id)
WHERE bur.profile_name IS NULL;

-- Log any remaining records without profile names (non-blocking)
DO $$
DECLARE
  missing_names INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_names
  FROM (
    SELECT id FROM business_members WHERE profile_name IS NULL
    UNION ALL
    SELECT id FROM business_user_roles WHERE profile_name IS NULL
  ) missing;
  
  IF missing_names > 0 THEN
    RAISE NOTICE 'Found % records that could not be updated with profile names', missing_names;
  END IF;
END;
$$;