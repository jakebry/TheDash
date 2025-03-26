/*
  # Create function to update user role in auth.users

  1. Changes
    - Create RPC function to update user role in auth metadata
    - Add triggering function to synchronize roles between profiles and auth.users
    - Ensure proper security with SECURITY DEFINER

  2. Security
    - Secure function with SECURITY DEFINER to run with elevated privileges
    - Only allow updating role field to prevent other metadata changes
*/

-- This function allows updating the role in user metadata via RPC
CREATE OR REPLACE FUNCTION update_user_role(user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  -- Update user metadata with new role
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('role', new_role)
      ELSE 
        raw_user_meta_data || jsonb_build_object('role', new_role)
    END
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to sync profile role changes to auth.users
CREATE OR REPLACE FUNCTION sync_profile_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user metadata when profile role changes
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('role', NEW.role)
      ELSE 
        raw_user_meta_data || jsonb_build_object('role', NEW.role)
    END
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync profile role changes to auth.users
DROP TRIGGER IF EXISTS sync_profile_role_to_auth_trigger ON public.profiles;
CREATE TRIGGER sync_profile_role_to_auth_trigger
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION sync_profile_role_to_auth();