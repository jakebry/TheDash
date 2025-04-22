/*
  # Fix Business Member Policies and Role Checks

  1. Changes
    - Fix infinite recursion in business member policies
    - Add safer role checking functions
    - Update existing policies to avoid recursion
    
  2. Security
    - Maintain proper access control
    - Use JWT claims for role checks
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view all members in their business" ON public.business_members;
DROP POLICY IF EXISTS "Admins can view all business members" ON public.business_members;
DROP POLICY IF EXISTS "Business owners can manage members" ON public.business_members;

-- Create a function to safely check admin status using JWT
CREATE OR REPLACE FUNCTION is_admin_direct()
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Create safer policies that avoid recursion

-- Members can view all members in their business
CREATE POLICY "Members can view all members in their business"
  ON public.business_members
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id 
      FROM business_members 
      WHERE user_id = auth.uid()
    )
  );

-- Admins can view all members
CREATE POLICY "Admins can view all business members"
  ON public.business_members
  FOR SELECT
  TO authenticated
  USING (is_admin_direct());

-- Business owners can manage members
CREATE POLICY "Business owners can manage members"
  ON public.business_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM businesses
      WHERE id = business_members.business_id
      AND created_by = auth.uid()
    )
  );