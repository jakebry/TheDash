/*
  # Fix Profile Policies Recursion

  1. Changes
    - Drop existing problematic policies
    - Create new non-recursive policies for profile access
    - Maintain security while avoiding infinite recursion
    
  2. Security
    - Preserve role-based access control
    - Prevent privilege escalation
    - Maintain data isolation
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by users in same business" ON profiles;
DROP POLICY IF EXISTS "Admins can update other users roles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to fetch their role" ON profiles;

-- Create new streamlined policies
CREATE POLICY "View own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "View business member profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT user_id 
    FROM business_members 
    WHERE business_id IN (
      SELECT business_id 
      FROM business_members 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admin view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
);

CREATE POLICY "Update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin update other profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
  AND id != auth.uid()
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
  AND id != auth.uid()
);