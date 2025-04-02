/*
  # Allow all authenticated users to read profiles

  1. Changes
    - Add SELECT policy for public.profiles for all authenticated users

  2. Security
    - This enables invite modals and user search functionality
*/

-- Enable RLS if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop old conflicting policies (safe cleanup)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles safely" ON public.profiles;
DROP POLICY IF EXISTS "Users with business role can view profiles" ON public.profiles;

-- Add new SELECT policy for any logged-in user
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
  );
