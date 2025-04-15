-- Updated role change function without recursion/trigger conflicts
CREATE OR REPLACE FUNCTION public.update_user_role_with_validation(
  target_user_id uuid,
  new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
  current_user_role TEXT;
  target_user_name TEXT;
  target_user_email TEXT;
  valid_role BOOLEAN;
  previous_role TEXT;
BEGIN
  -- Get current user's role
  SELECT role::text INTO current_user_role
  FROM profiles
  WHERE id = auth.uid();

  IF current_user_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can change user roles',
      'status', 403
    );
  END IF;

  -- Validate target role exists in enum
  SELECT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = new_role
      AND enumtypid = 'user_role'::regtype::oid
  ) INTO valid_role;

  IF NOT valid_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid role: %s', new_role),
      'status', 400
    );
  END IF;

  -- Get current user info
  SELECT full_name, email, role::text INTO target_user_name, target_user_email, previous_role
  FROM profiles
  WHERE id = target_user_id;

  IF previous_role = new_role THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'User already has the requested role',
      'user_id', target_user_id,
      'new_role', new_role
    );
  END IF;

  -- Perform manual update (instead of trigger)
  UPDATE profiles
  SET role = new_role::user_role
  WHERE id = target_user_id;

  -- Manually sync metadata in auth.users
  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = target_user_id;

  -- Optional: manually insert notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    target_user_id,
    'Role Updated',
    format('Your role was updated from %s to %s', previous_role, new_role),
    'role_change'
  );

  result := jsonb_build_object(
    'success', true,
    'message', format('Role updated from %s to %s', previous_role, new_role),
    'user_id', target_user_id,
    'new_role', new_role,
    'previous_role', previous_role
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'status', 500
    );
END;
$function$;