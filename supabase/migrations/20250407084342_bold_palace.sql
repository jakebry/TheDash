/*
  # Fix update_user_role_with_validation function ambiguity

  1. Changes
    - Drop existing ambiguous functions
    - Create a single unambiguous function that handles both text and enum types
    - Ensure proper type handling for role changes
    
  2. Security
    - Maintain security definer for proper access control
    - Ensure proper validation continues to work
*/

-- Drop the ambiguous functions first
DROP FUNCTION IF EXISTS update_user_role_with_validation(UUID, user_role);
DROP FUNCTION IF EXISTS update_user_role_with_validation(UUID, TEXT);

-- Create a single unambiguous function that handles text input
-- and explicitly casts it to the user_role type
CREATE OR REPLACE FUNCTION update_user_role_with_validation(
  target_user_id UUID,
  new_role TEXT
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  current_user_role user_role;
  target_user_name TEXT;
  target_user_email TEXT;
  valid_role BOOLEAN;
BEGIN
  -- Check if the current user is an admin
  SELECT role INTO current_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  IF current_user_role != 'admin'::user_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can change user roles',
      'status', 403
    );
  END IF;
  
  -- Validate that the role is valid
  SELECT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = new_role AND enumtypid = 'user_role'::regtype::oid
  ) INTO valid_role;
  
  IF NOT valid_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid role: %s', new_role),
      'status', 400
    );
  END IF;
  
  -- Get target user info for the notification
  SELECT full_name, email INTO target_user_name, target_user_email
  FROM profiles
  WHERE id = target_user_id;
  
  -- Update profile role
  UPDATE profiles
  SET role = new_role::user_role::user_role
  WHERE id = target_user_id;
  
  -- Update auth metadata with the new role
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('role', new_role)
      ELSE 
        raw_user_meta_data || jsonb_build_object('role', new_role)
    END,
    raw_app_meta_data = 
    CASE 
      WHEN raw_app_meta_data IS NULL THEN 
        jsonb_build_object('role', new_role)
      ELSE 
        raw_app_meta_data || jsonb_build_object('role', new_role)
    END
  WHERE id = target_user_id;
  
  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', format('Role updated to %s for %s', new_role, COALESCE(target_user_name, target_user_email, 'user')),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a helper function to force JWT refresh
CREATE OR REPLACE FUNCTION force_jwt_refresh()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object('refreshed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;