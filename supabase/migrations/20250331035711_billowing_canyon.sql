/*
  # Fix User Role Assignment

  1. Changes
    - Add function to handle new user creation with proper role assignment
    - Add trigger to ensure role is set in both profile and auth metadata
    - Add function to sync roles between profile and auth metadata
    
  2. Security
    - Use security definer for elevated privileges
    - Ensure proper role assignment on signup
*/

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Set default role to 'user' if not specified
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user'::user_role)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    role = EXCLUDED.role,
    updated_at = now();

  -- Ensure role is set in user metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('role', 'user')
      ELSE 
        raw_user_meta_data || jsonb_build_object('role', 'user')
    END,
    raw_app_meta_data = 
    CASE 
      WHEN raw_app_meta_data IS NULL THEN 
        jsonb_build_object('role', 'user')
      ELSE 
        raw_app_meta_data || jsonb_build_object('role', 'user')
    END
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to sync roles between profile and auth
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS trigger AS $$
BEGIN
  -- Update auth metadata when profile role changes
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('role', NEW.role)
      ELSE 
        raw_user_meta_data || jsonb_build_object('role', NEW.role)
    END,
    raw_app_meta_data = 
    CASE 
      WHEN raw_app_meta_data IS NULL THEN 
        jsonb_build_object('role', NEW.role)
      ELSE 
        raw_app_meta_data || jsonb_build_object('role', NEW.role)
    END
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_user_role_trigger ON public.profiles;

-- Create trigger for role synchronization
CREATE TRIGGER sync_user_role_trigger
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role();