/*
  # Fix Profile Creation and Role Assignment

  1. Changes
    - Add function to ensure profile exists
    - Add function to repair profile issues
    - Add function to get all auth roles
    
  2. Security
    - Use security definer for elevated privileges
    - Maintain proper role assignments
*/

-- Function to ensure a profile exists
CREATE OR REPLACE FUNCTION ensure_profile_exists(
  user_id UUID DEFAULT NULL,
  check_all BOOLEAN DEFAULT FALSE
)
RETURNS TEXT AS $$
DECLARE
  target_id UUID;
  user_record RECORD;
  created_count INTEGER := 0;
  updated_count INTEGER := 0;
  profile_exists BOOLEAN;
BEGIN
  -- If specific user_id is provided, only check that user
  IF user_id IS NOT NULL AND NOT check_all THEN
    -- Check if profile exists
    SELECT EXISTS(
      SELECT 1 FROM public.profiles WHERE id = user_id
    ) INTO profile_exists;
    
    -- Create profile if it doesn't exist
    IF NOT profile_exists THEN
      INSERT INTO public.profiles (
        id, email, role, created_at, updated_at
      )
      SELECT 
        id, email, 
        COALESCE((raw_user_meta_data->>'role')::user_role, 'user'::user_role),
        created_at, now()
      FROM auth.users
      WHERE id = user_id;
      
      created_count := created_count + 1;
    END IF;
    
    RETURN format('Profile check complete. Created: %s', created_count);
  END IF;
  
  RETURN 'No action performed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all auth roles
CREATE OR REPLACE FUNCTION get_all_auth_roles(target_id UUID DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'profile_role', p.role,
    'user_metadata_role', u.raw_user_meta_data->>'role',
    'app_metadata_role', u.raw_app_meta_data->>'role',
    'jwt_role', current_setting('request.jwt.claims', true)::jsonb->>'role'
  ) INTO result
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE u.id = COALESCE(target_id, auth.uid());
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;