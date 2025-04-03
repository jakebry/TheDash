/*
  # Fix Role Synchronization

  1. Changes
    - Add trigger to sync business member roles with profile roles
    - Fix business creation to assign the creator as a member
    - Leave business_members.role as TEXT (not enum)

  2. Security
    - Use security definer for proper access control
    - Maintain proper role assignments
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_member_role_trigger ON public.business_members;

-- ✅ Do NOT cast business_members.role to enum — keep it as TEXT

-- Create function to sync member role with profile
CREATE OR REPLACE FUNCTION sync_member_role()
RETURNS trigger AS $$
DECLARE
  profile_role user_role;
BEGIN
  -- Get the user's global role from profiles
  SELECT role INTO profile_role
  FROM profiles
  WHERE id = NEW.user_id;

  -- Assign that global role into a business member context (as text)
  NEW.role := profile_role::text;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync role on insert/update
CREATE TRIGGER sync_member_role_trigger
  BEFORE INSERT OR UPDATE ON public.business_members
  FOR EACH ROW
  EXECUTE FUNCTION sync_member_role();

-- Sync existing business_members.role to match profile.role
UPDATE business_members bm
SET role = p.role::text
FROM profiles p
WHERE bm.user_id = p.id;

-- Fix business creation trigger to assign the creator to their business
CREATE OR REPLACE FUNCTION handle_business_creation()
RETURNS trigger AS $$
DECLARE
  creator_role user_role;
BEGIN
  -- Get creator's global role from profiles
  SELECT role INTO creator_role
  FROM profiles
  WHERE id = NEW.created_by;

  -- Add the business creator as a member with that role
  INSERT INTO public.business_members (
    business_id,
    user_id,
    role
  ) VALUES (
    NEW.id,
    NEW.created_by,
    creator_role::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
