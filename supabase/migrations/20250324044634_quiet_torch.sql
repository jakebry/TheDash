/*
  # Add INSERT policy for profiles

  1. Changes
    - Add new RLS policy for authenticated users to insert their own profile
    
  2. Security
    - Ensures users can only create profiles for themselves
    - Maintains security by checking user ID matches
*/

-- Add INSERT policy for profiles
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);