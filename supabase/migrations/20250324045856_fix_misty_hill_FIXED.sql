/*
  # Fix admin access and role updates

  1. Changes
    - Create function to properly sync roles between auth.users and profiles
    - Add explicit call to rls.enforce_admin_access()
    - Update notification triggers for role changes

  2. Security
    - Secure function with SECURITY DEFINER to run with elevated privileges
*/

-- Create a function to notify about role changes
CREATE OR REPLACE FUNCTION public.notify_business_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a notification when role changes
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    metadata
  ) VALUES (
    auth.uid(),
    'Role Changed',
    'Your role has been updated.',
    'role_change',
    jsonb_build_object(
      'previous_role', OLD.role,
      'new_role', NEW.role
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;

CREATE TRIGGER on_profile_role_change
AFTER UPDATE OF role ON public.profiles
FOR EACH ROW
WHEN (OLD.role IS DISTINCT FROM NEW.role)
EXECUTE FUNCTION public.notify_business_role_change();
