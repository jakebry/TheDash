/*
  # Fix Role Synchronization and Add Admin Policies

  1. Changes
    - Add policies for admin access to businesses and members
    - Fix role synchronization between profiles and business_members
    - Add function to properly handle role changes
    
  2. Security
    - Ensure admins can view and manage all businesses
    - Maintain proper role assignments
*/

-- Add admin policies for businesses
CREATE POLICY "Admins can view all businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'::user_role
    )
  );

-- Add admin policies for business_members
CREATE POLICY "Admins can view all business members"
  ON public.business_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'::user_role
    )
  );

-- Function to handle role changes and sync to business_members
CREATE OR REPLACE FUNCTION handle_role_change_notification()
RETURNS trigger AS $$
BEGIN
  -- Update business_members role when profile role changes
  UPDATE business_members
  SET role = NEW.role
  WHERE user_id = NEW.id;

  -- Create notification for role change
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    metadata
  ) VALUES (
    NEW.id,
    'Role Updated',
    CASE 
      WHEN NEW.role = 'admin' THEN 'You have been granted administrator privileges'
      WHEN NEW.role = 'business' THEN 'You have been granted business privileges'
      ELSE 'Your role has been updated to ' || NEW.role::text
    END,
    'role_change',
    jsonb_build_object(
      'previous_role', OLD.role,
      'new_role', NEW.role
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role changes
DROP TRIGGER IF EXISTS on_role_change ON public.profiles;
CREATE TRIGGER on_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION handle_role_change_notification();

-- Function to ensure proper role assignment
CREATE OR REPLACE FUNCTION update_user_role_with_validation(
  target_user_id UUID,
  new_role user_role
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Update profile role
  UPDATE profiles
  SET role = new_role::user_role
  WHERE id = target_user_id;

  -- Update auth metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object('role', new_role::text)
      ELSE 
        raw_user_meta_data || jsonb_build_object('role', new_role::text)
    END,
    raw_app_meta_data = 
    CASE 
      WHEN raw_app_meta_data IS NULL THEN 
        jsonb_build_object('role', new_role::text)
      ELSE 
        raw_app_meta_data || jsonb_build_object('role', new_role::text)
    END
  WHERE id = target_user_id;

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', format('Role updated to %s', new_role)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;