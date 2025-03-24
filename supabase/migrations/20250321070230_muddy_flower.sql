/*
  # Add Business Role Notification Trigger

  1. Changes
    - Add trigger for business role changes
    - Create notification for new business users
    
  2. Security
    - Use security definer for proper access control
    - Maintain existing RLS policies
*/

-- Create function to handle business role notification
CREATE OR REPLACE FUNCTION notify_business_role_change()
RETURNS trigger AS $$
BEGIN
  -- Check if role was changed to business
  IF NEW.role = 'business' AND (OLD.role IS NULL OR OLD.role != 'business') THEN
    -- Create notification for the user
    PERFORM create_notification(
      NEW.id,
      'Welcome to Business Management',
      'You now have business privileges. Create your company profile to get started.',
      'business_role',
      jsonb_build_object(
        'action', 'create_business'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role changes
CREATE TRIGGER on_business_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_business_role_change();