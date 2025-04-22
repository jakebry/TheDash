/*
  # Fix Business Member Visibility

  1. Changes
    - Drop existing member visibility policies
    - Add new policies to allow team members to view other members
    - Maintain admin access policies
    
  2. Security
    - Ensure proper access control
    - Maintain data privacy between businesses
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own membership" ON public.business_members;
DROP POLICY IF EXISTS "Admins can view all business members" ON public.business_members;

-- Create new policies for business member visibility

-- Allow members to view all other members in their business
CREATE POLICY "Members can view all members in their business"
  ON public.business_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM business_members viewer
      WHERE viewer.business_id = business_members.business_id
      AND viewer.user_id = auth.uid()
    )
  );

-- Admins can still view everything
CREATE POLICY "Admins can view all business members"
  ON public.business_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'::user_role
    )
  );

-- Allow business owners to manage members
CREATE POLICY "Business owners can manage members"
  ON public.business_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM businesses
      WHERE businesses.id = business_members.business_id
      AND businesses.created_by = auth.uid()
    )
  );