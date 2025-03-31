/*
  # Fix User Role Assignment on Signup

  1. Changes
    - Create trigger to ensure default role assignment
    - Add function to handle role assignment
    - Add validation to prevent null roles
    
  2. Security
    - Maintain RLS policies
    - Use security definer for proper access
*/

-- Function to handle role assignment
CREATE OR REPLACE FUNCTION handle_role_assignment()
RETURNS trigger AS $$
BEGIN
  -- Ensure role is never null, default to 'user'
  IF NEW.role IS NULL THEN
    NEW.role := 'user'::user_role;
  END IF;

  -- Update auth.users metadata to match
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('role', NEW.role::text)
      ELSE 
        raw_user_meta_data || jsonb_build_object('role', NEW.role::text)
    END
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role assignment
DROP TRIGGER IF EXISTS ensure_role_assignment ON public.profiles;
CREATE TRIGGER ensure_role_assignment
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_role_assignment();