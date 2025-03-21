/*
  # Fix Profile Policies with Role Protection

  1. Changes
    - Drop existing policies
    - Create new policies with proper role protection
    - Fix NEW table reference issue
    
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
    FROM profiles admin_check
    WHERE admin_check.id = auth.uid() 
    AND admin_check.role = 'admin'
  )
);

CREATE POLICY "Allow users to update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  -- Users can update everything except their role
  EXISTS (
    SELECT 1
    FROM profiles current_profile
    WHERE current_profile.id = auth.uid()
    AND (
      -- Either the role is not being changed
      role = current_profile.role
      OR
      -- Or no role was provided (other fields being updated)
      role IS NULL
    )
  )
);

CREATE POLICY "Allow admins to update other profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles admin_check
    WHERE admin_check.id = auth.uid() 
    AND admin_check.role = 'admin'
  )
  AND id != auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles admin_check
    WHERE admin_check.id = auth.uid() 
    AND admin_check.role = 'admin'
  )
  AND id != auth.uid()
);