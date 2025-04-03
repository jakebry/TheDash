/*
  # Fix Role Synchronization

  1. Changes
    - Add trigger to sync business member roles with profile roles
    - Fix business creation to use correct role type
    - Add constraint to ensure role matches user_role type
    
  2. Security
    - Use security definer for proper access control
    - Maintain proper role assignments
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_member_role_trigger ON public.business_members;

-- Alter business_members table to use user_role type
ALTER TABLE business_members 
ALTER COLUMN role TYPE user_role 
USING role::user_role;

-- Create function to sync member role with profile
CREATE OR REPLACE FUNCTION sync_member_role()
RETURNS trigger AS $$
DECLARE
  profile_role user_role;
BEGIN
  -- Get the user's role from profiles
  SELECT role INTO profile_role
  FROM profiles
  WHERE id = NEW.user_id;

  -- Set the member role to match profile role
  NEW.role := profile_role;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync role on insert/update
CREATE TRIGGER sync_member_role_trigger
  BEFORE INSERT OR UPDATE ON public.business_members
  FOR EACH ROW
  EXECUTE FUNCTION sync_member_role();

-- Fix existing member roles
UPDATE business_members bm
SET role = p.role
FROM profiles p
WHERE bm.user_id = p.id;

-- Fix business creation trigger to use correct role type
CREATE OR REPLACE FUNCTION handle_business_creation()
RETURNS trigger AS $$
DECLARE
  creator_role user_role;
BEGIN
  -- Get creator's role from profiles
  SELECT role INTO creator_role
  FROM profiles
  WHERE id = NEW.created_by;

  -- Add the business creator as a member with their profile role
  INSERT INTO public.business_members (
    business_id,
    user_id,
    role
  ) VALUES (
    NEW.id,
    NEW.created_by,
    creator_role
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;