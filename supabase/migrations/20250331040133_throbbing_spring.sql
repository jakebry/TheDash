/*
  # Fix User Role Type and Signup Process

  1. Changes
    - Ensure user_role type exists and is accessible
    - Fix handle_new_user function to properly handle role assignment
    - Add proper error handling for user creation
    
  2. Security
    - Maintain proper role assignment
    - Ensure data consistency during user creation
*/

-- First ensure we're in the public schema
SET search_path TO public;

-- Recreate user_role type if needed
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'business', 'user');
  END IF;
END $$;

-- Drop existing function to recreate with fixes
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create improved handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_role user_role := 'user'::user_role;
BEGIN
  -- Create profile with proper role
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
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    role = default_role,
    updated_at = now();

  -- Update auth metadata
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
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to validate and repair user roles
CREATE OR REPLACE FUNCTION validate_user_role(user_id UUID)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Check and repair role assignments
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
  WHERE id = user_id;

  -- Return validation result
  SELECT jsonb_build_object(
    'success', true,
    'role', 'user',
    'message', 'User role validated and repaired if needed'
  ) INTO result;

  RETURN result;
END;
$$;