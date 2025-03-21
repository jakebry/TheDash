/*
  # Add Admin User Management Policies

  1. Changes
    - Add policies for admins to view and update all user profiles
    - Ensure admins can't modify their own role for security
    
  2. Security
    - Only admins can view and modify user roles
    - Prevent role escalation attacks
*/

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update other users' roles
CREATE POLICY "Admins can update other users roles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  -- Admin check
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  -- Prevent admins from modifying their own role
  AND id != auth.uid()
)
WITH CHECK (
  -- Admin check
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  -- Prevent admins from modifying their own role
  AND id != auth.uid()
);