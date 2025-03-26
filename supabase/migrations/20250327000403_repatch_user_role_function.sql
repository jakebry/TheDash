-- Drop the old function if it exists
DROP FUNCTION IF EXISTS public.update_user_role_with_validation(UUID, TEXT);

-- Create the fixed function
CREATE FUNCTION public.update_user_role_with_validation(
  target_user_id UUID,
  new_role TEXT
)
RETURNS JSONB AS $$
DECLARE
  role_valid BOOLEAN;
  user_valid BOOLEAN;
  current_role TEXT;
  current_user UUID := auth.uid();
BEGIN
  -- Validate user exists
  SELECT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = target_user_id
  ) INTO user_valid;

  IF NOT user_valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User does not exist'
    );
  END IF;

  -- Validate role
  role_valid := new_role IN ('admin', 'business', 'user');
  IF NOT role_valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid role. Must be: admin, business, or user'
    );
  END IF;

  -- Get current role
  SELECT p.role::TEXT INTO current_role
  FROM profiles p
  WHERE p.id = target_user_id;

  IF current_role = new_role THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No change needed - role already set to ' || new_role
    );
  END IF;

  -- Update role
  UPDATE profiles p
  SET role = new_role::user_role,
      updated_at = now()
  WHERE p.id = target_user_id;

  -- Admin notification
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    metadata
  ) VALUES (
    current_user,
    'Role Updated',
    format('Role updated to %s for user', new_role),
    'role_change',
    jsonb_build_object(
      'affected_user', target_user_id,
      'previous_role', current_role,
      'new_role', new_role
    )
  );

  -- Affected user notification
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    metadata
  ) VALUES (
    target_user_id,
    'Your Role Has Changed',
    format('Your role has been updated to %s', new_role),
    'role_change',
    jsonb_build_object(
      'previous_role', current_role,
      'new_role', new_role,
      'requires_refresh', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Role updated from %s to %s', current_role, new_role),
    'user_id', target_user_id,
    'new_role', new_role,
    'previous_role', current_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
