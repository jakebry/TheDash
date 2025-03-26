-- Drop the existing function to allow redefinition with a new return type
DROP FUNCTION IF EXISTS public.update_user_role_with_validation(UUID, TEXT);

-- Create the function with corrected logic and return type
CREATE OR REPLACE FUNCTION public.update_user_role_with_validation(
  target_user_id UUID,
  new_role TEXT
)
RETURNS JSONB AS $$
DECLARE
  current_uid UUID := current_user_id();
  current_role TEXT;
BEGIN
  -- Normalize role to lowercase
  new_role := LOWER(new_role);

  -- Validate role
  IF new_role NOT IN ('admin', 'business', 'user') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role. Must be: admin, business, or user');
  END IF;

  -- Check that the current user is an Admin

  CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::user_role
);
  SELECT u.raw_app_meta_data ->> 'role'
  INTO current_role
  FROM auth.users u
  WHERE u.id = current_uid;

  IF current_role != 'Admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Update auth.users
  UPDATE auth.users u
  SET raw_app_meta_data = jsonb_set(u.raw_app_meta_data, '{role}', to_jsonb(new_role::TEXT))
  WHERE u.id = target_user_id;

  -- Update profiles table
  UPDATE public.profiles p
  SET role = new_role
  WHERE p.id = target_user_id;

  RETURN jsonb_build_object('success', true, 'new_role', new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
