/*
  # Fix Business Member Visibility

  1. Changes
    - Drop existing member visibility policies
    - Prepare for new policies in subsequent migrations
    
  2. Security
    - Ensure proper access control
    - Maintain data privacy between businesses
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own membership" ON public.business_members;
DROP POLICY IF EXISTS "Admins can view all business members" ON public.business_members;
DROP POLICY IF EXISTS "Members can view all members in their business" ON public.business_members;
DROP POLICY IF EXISTS "Business owners can manage members" ON public.business_members;