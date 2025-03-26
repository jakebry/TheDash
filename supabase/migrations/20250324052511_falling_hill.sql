/*
  # Fix Infinite Recursion in Profiles Policies

  1. Changes
    - Fixes the infinite recursion in profiles policies
    - Modifies how admin status is determined
    - Creates safer policies for profile access
    
  2. Security
    - Maintains proper row-level security
    - Prevents infinite recursion while ensuring proper access control
*/

-- Drop the policies causing recursion issues
DROP POLICY IF EXISTS "Admins can view all profiles safely" ON public.profiles;
DROP POLICY IF EXISTS "Direct admin select for user management" ON public.profiles;

-- Create a better admin check function that doesn't cause recursion
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

-- Add a simpler and more direct policy for regular users
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Add a completely separate policy for admin access
CREATE POLICY "Admins can view all profiles safely"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- This approach avoids recursion by:
    -- 1. First checking JWT claims directly (fast path)
    -- 2. If that fails, checking the user's own role in a way that doesn't recurse
    is_admin_jwt() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND 
      (raw_user_meta_data->>'role') = 'admin'
    )
  );

-- Make sure we have the user update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Make sure we have the insert policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);