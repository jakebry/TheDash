/*
  # Fix Infinite Recursion in Profile Policies

  1. Changes
    - Drop the recursive admin policy that's causing infinite recursion
    - Create a new admin policy that avoids recursion by using auth.jwt() instead
    - Add a helper function to safely check admin status
    - Handle policy that already exists by first dropping it
    
  2. Security
    - Maintains same level of security
    - Preserves admin ability to view all profiles
    - Eliminates infinite recursion error
*/

-- First drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Drop existing insert policy before recreating it
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create a helper function to safely check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Using auth.jwt() to get role from the JWT directly
  -- This avoids querying the profiles table which causes recursion
  RETURN (auth.jwt() ->> 'role')::text = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new non-recursive policy for admin access
CREATE POLICY "Admins can view all profiles safely"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR
    auth.uid() = id  -- Allow viewing own profile as a fallback
  );

-- Create a policy that allows users to insert their own profiles
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);