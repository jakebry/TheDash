/*
  # Fix admin visibility for profiles

  1. Changes
    - Add policy that allows admin users to view all profiles
    - Ensure admin role synchronization works properly
    
  2. Security
    - Keeps existing RLS intact for non-admin users
    - Only grants additional visibility to admin users
*/

-- Add policy to allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::user_role
  );

-- Create a function to ensure proper role sync
CREATE OR REPLACE FUNCTION check_and_fix_role_sync()
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Iterate through all profiles
  FOR user_record IN 
    SELECT p.id, p.role, u.raw_user_meta_data->>'role' as auth_role
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.role::text IS DISTINCT FROM u.raw_user_meta_data->>'role'
  LOOP
    -- Sync the auth metadata to match profile role
    UPDATE auth.users
    SET raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN 
          jsonb_build_object('role', user_record.role)
        ELSE 
          raw_user_meta_data || jsonb_build_object('role', user_record.role::text)
      END
    WHERE id = user_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the fix once when migration is applied
SELECT check_and_fix_role_sync();