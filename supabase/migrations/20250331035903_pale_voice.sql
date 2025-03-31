/*
  # Fix User Signup and Role Assignment

  1. Changes
    - Fix handle_new_user function to properly handle initial signup
    - Add better error handling for role assignment
    - Ensure proper metadata synchronization
    
  2. Security
    - Maintain security with SECURITY DEFINER
    - Ensure proper role assignment
*/

-- Drop existing function and recreate with fixes
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_role user_role := 'user'::user_role;
BEGIN
  -- Create profile first
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    default_role,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Then update auth metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object(
          'role', default_role::text,
          'full_name', NEW.raw_user_meta_data->>'full_name'
        )
      ELSE 
        raw_user_meta_data || 
        jsonb_build_object(
          'role', default_role::text
        )
    END,
    raw_app_meta_data = 
    CASE 
      WHEN raw_app_meta_data IS NULL THEN 
        jsonb_build_object('role', default_role::text)
      ELSE 
        raw_app_meta_data || 
        jsonb_build_object('role', default_role::text)
    END
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details but don't fail the transaction
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to ensure profile exists with proper role
CREATE OR REPLACE FUNCTION repair_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  profile_exists BOOLEAN;
  current_role user_role;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = user_id
  ) INTO profile_exists;

  IF NOT profile_exists THEN
    -- Create profile if missing
    INSERT INTO public.profiles (
      id,
      email,
      role,
      created_at,
      updated_at
    )
    SELECT 
      id,
      email,
      'user'::user_role,
      created_at,
      now()
    FROM auth.users
    WHERE id = user_id;

    RETURN 'Created new profile with user role';
  END IF;

  -- Get current role
  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = user_id;

  -- Update auth metadata to match profile
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('role', current_role::text)
      ELSE 
        raw_user_meta_data || 
        jsonb_build_object('role', current_role::text)
    END,
    raw_app_meta_data = 
    CASE 
      WHEN raw_app_meta_data IS NULL THEN 
        jsonb_build_object('role', current_role::text)
      ELSE 
        raw_app_meta_data || 
        jsonb_build_object('role', current_role::text)
    END
  WHERE id = user_id;

  RETURN format('Updated user role to %s', current_role::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;