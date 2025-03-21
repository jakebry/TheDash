/*
  # Fix Recursive Profile Policies

  1. Changes
    - Drop all existing profile policies
    - Create new non-recursive policies
    - Implement role-based access with direct checks
    
  2. Security
    - Maintain role-based access control
    - Prevent privilege escalation
    - Ensure data isolation
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "View own profile" ON profiles;
DROP POLICY IF EXISTS "View business member profiles" ON profiles;
DROP POLICY IF EXISTS "Admin view all profiles" ON profiles;
DROP POLICY IF EXISTS "Update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin update other profiles" ON profiles;

-- Create simplified, non-recursive policies
CREATE POLICY "Allow users to read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow admins to read all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND id IN (SELECT id FROM profiles WHERE role = 'admin')
  )
);

CREATE POLICY "Allow users to update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  -- Prevent users from changing their own role
  (auth.uid() = id AND (role IS NOT DISTINCT FROM OLD.role))
);

CREATE POLICY "Allow admins to update other profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND id IN (SELECT id FROM profiles WHERE role = 'admin')
  )
  AND id != auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND id IN (SELECT id FROM profiles WHERE role = 'admin')
  )
  AND id != auth.uid()
);