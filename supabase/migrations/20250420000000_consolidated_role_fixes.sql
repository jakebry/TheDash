
-- Consolidated fixes for role updates and enum casting

-- Create or replace safe user role update function
CREATE OR REPLACE FUNCTION public.update_user_role_safely(
  target_user_id uuid,
  new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  current_user_role user_role;
  valid_role BOOLEAN;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role FROM profiles WHERE id = auth.uid();

  -- Only allow admin to promote users
  IF current_user_role != 'admin'::user_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can change user roles',
      'status', 403
    );
  END IF;

  -- Ensure the new role is a valid enum value
  SELECT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = new_role
    AND enumtypid = 'user_role'::regtype::oid
  ) INTO valid_role;

  IF NOT valid_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid role',
      'status', 400
    );
  END IF;

  -- Update profile with new role
  UPDATE profiles
  SET role = new_role::user_role
  WHERE id = target_user_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role updated',
    'user_id', target_user_id,
    'new_role', new_role
  );
END;
$$;
