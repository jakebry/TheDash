/*
  # Create business invitation flow

  1. Changes
    - Drop existing policies before recreating them
    - Fix permission issues for business access
    
  2. Security
    - Ensure proper access control for business members
    - Use security definer function for role checks
*/

-- First drop all existing policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Users with business role can view businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users with business role can create businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can insert themselves into business_members" ON public.business_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON public.business_members;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS is_business_or_admin();

-- Helper function to check if user is business or admin
CREATE FUNCTION is_business_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role IN ('business', 'admin')
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy for viewing businesses where user is a member
CREATE POLICY "Users with business role can view businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (is_business_or_admin() OR 
        EXISTS (
          SELECT 1 FROM business_members
          WHERE business_members.business_id = businesses.id
          AND business_members.user_id = auth.uid()
        ));

-- Make sure users with business role can create businesses
CREATE POLICY "Users with business role can create businesses"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (is_business_or_admin());

-- Ensure users can insert themselves into business_members
CREATE POLICY "Users can insert themselves into business_members"
  ON public.business_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add policies for business_members to allow viewing membership
CREATE POLICY "Users can view their own membership"
  ON public.business_members
  FOR SELECT
  TO public
  USING (user_id = auth.uid());