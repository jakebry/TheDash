CREATE OR REPLACE FUNCTION public.update_user_role_with_validation(
  target_user_id UUID,
  new_role TEXT
)
RETURNS JSONB AS $$
DECLARE
  current_uid UUID := current_user_id();
  current_role TEXT;
BEGIN
  -- Normalize role
  new_role := LOWER(new_role);

  -- Validate role
  IF new_role NOT IN ('admin', 'business', 'user') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role. Must be: admin, business, or user');
  END IF;

  -- Ensure current user is admin
  SELECT u.raw_app_meta_data ->> 'role'
  INTO current_role
  FROM auth.users AS u
  WHERE u.id = current_uid;

  IF LOWER(current_role) != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Update auth.users metadata
  UPDATE auth.users AS u
  SET raw_app_meta_data = jsonb_set(u.raw_app_meta_data, '{role}', to_jsonb(new_role))
  WHERE u.id = target_user_id;

  -- Update profiles table
  UPDATE public.profiles AS p
  SET role = new_role
  WHERE p.id = target_user_id;

  RETURN jsonb_build_object('success', true, 'new_role', new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
