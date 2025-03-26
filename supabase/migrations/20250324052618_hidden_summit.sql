/*
  # Fix Permission Issues with Users Table

  1. Changes
    - Creates a secure function to access user information
    - Adds improved policies for profile access
    - Fixes recursion and permission issues with auth.users table
    
  2. Security
    - Maintains proper security while enabling needed functionality
    - Uses proper SECURITY DEFINER functions for controlled access
*/

-- Create a more secure way to check admin status
CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS BOOLEAN AS $$
BEGIN
  -- Get the role from JWT claims directly
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false; -- Default to false if anything goes wrong
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a secure RPC function to get user data safely
CREATE OR REPLACE FUNCTION public.get_user_by_id(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_data JSONB;
BEGIN
  -- Only allow if requesting own data or admin
  IF auth.uid() = user_id OR is_admin_jwt() THEN
    SELECT 
      jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'role', COALESCE(u.raw_user_meta_data->>'role', 'user'),
        'created_at', u.created_at
      ) INTO user_data
    FROM auth.users u
    WHERE u.id = user_id;
    
    RETURN user_data;
  ELSE
    -- Return null if not authorized
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adjust existing profile policies to ensure they work correctly
DROP POLICY IF EXISTS "Admins can view all profiles safely" ON public.profiles;

-- Add a policy for admins to view all profiles that doesn't cause recursion
CREATE POLICY "Admins can view all profiles safely"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Use JWT claims to determine admin status without recursion
    is_admin_jwt() OR
    auth.uid() = id
  );

-- Create a function to repair profile/user relationship
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(
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
    ELSE
      -- Update existing profile if necessary
      UPDATE public.profiles p
      SET 
        email = u.email,
        role = COALESCE((u.raw_user_meta_data->>'role')::user_role, p.role),
        updated_at = now()
      FROM auth.users u
      WHERE p.id = u.id AND p.id = user_id;
      
      updated_count := updated_count + 1;
    END IF;
    
    RETURN format('Profile check complete. Created: %s, Updated: %s', 
                 created_count, updated_count);
  END IF;
  
  -- If check_all is true, verify all users have profiles
  IF check_all THEN
    -- Create missing profiles for all users
    INSERT INTO public.profiles (
      id, email, role, created_at, updated_at
    )
    SELECT 
      u.id, u.email, 
      COALESCE((u.raw_user_meta_data->>'role')::user_role, 'user'::user_role),
      u.created_at, now()
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    WHERE p.id IS NULL;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
    
    -- Update existing profiles with current data
    UPDATE public.profiles p
    SET 
      email = u.email,
      role = COALESCE((u.raw_user_meta_data->>'role')::user_role, p.role),
      updated_at = now()
    FROM auth.users u
    WHERE p.id = u.id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN format('Profile sync complete. Created: %s, Updated: %s', 
                 created_count, updated_count);
  END IF;
  
  RETURN 'No action performed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to repair admin visibility issues
CREATE OR REPLACE FUNCTION repair_admin_visibility()
RETURNS TEXT AS $$
DECLARE
  current_user_id UUID;
  current_user_role TEXT;
  profile_exists BOOLEAN;
  total_users INTEGER;
BEGIN
  current_user_id := auth.uid();
  
  -- Ensure the current user has a profile
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = current_user_id
  ) INTO profile_exists;
  
  IF NOT profile_exists THEN
    -- Create profile if missing
    PERFORM ensure_profile_exists(current_user_id);
  END IF;
  
  -- Get current user's role
  SELECT role::TEXT INTO current_user_role 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  -- If admin, ensure role is properly set in auth metadata
  IF current_user_role = 'admin' THEN
    UPDATE auth.users
    SET raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN 
          jsonb_build_object('role', 'admin')
        ELSE 
          jsonb_set(
            raw_user_meta_data, 
            '{role}', 
            '"admin"'
          )
      END
    WHERE id = current_user_id;
  END IF;
  
  -- Get total user count
  SELECT COUNT(*) INTO total_users FROM auth.users;
  
  -- Return diagnostic information
  RETURN format(
    'Admin visibility repaired. Your role: %s. Total users: %s.', 
    current_user_role, 
    total_users
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initial call to ensure all users have profiles
SELECT ensure_profile_exists(NULL, true);