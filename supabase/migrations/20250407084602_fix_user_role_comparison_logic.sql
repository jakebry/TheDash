-- Final patch: fix type mismatch by comparing role as text
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
  current_user_role user_role;
  target_user_name TEXT;
  target_user_email TEXT;
  valid_role BOOLEAN;
  current_role TEXT;
BEGIN
  SELECT role::text INTO current_user_role
  FROM profiles
  WHERE id = auth.uid();

  IF current_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can change user roles',
      'status', 403
    );
  END IF;

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

  SELECT full_name, email, role::text INTO target_user_name, target_user_email, current_role
  FROM profiles
  WHERE id = target_user_id;

  IF current_role IS DISTINCT FROM new_role THEN
    UPDATE profiles
    SET role = new_role::user_role::user_role
    WHERE id = target_user_id;
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = target_user_id;

  result := jsonb_build_object(
    'success', true,
    'message', format('Role updated to %s for %s', new_role, coalesce(target_user_name, target_user_email, 'user')),
    'user_id', target_user_id,
    'new_role', new_role
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