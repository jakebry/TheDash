/*
  # Add function to update profile role

  1. Changes
    - Create function to update profile role via a trigger
    - Add trigger to update profile role when user metadata changes

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS
*/

-- Create or replace function to update profile role when user metadata changes
CREATE OR REPLACE FUNCTION public.update_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if role in metadata has changed
  IF (OLD.raw_user_meta_data->>'role') IS DISTINCT FROM (NEW.raw_user_meta_data->>'role') THEN
    -- Update the profile with the new role
    UPDATE public.profiles
    SET
      role = (NEW.raw_user_meta_data->>'role')::user_role,
      updated_at = now()
    WHERE id = NEW.id;

    -- Create a notification for the user about their role change
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      metadata
    )
    VALUES (
      NEW.id,
      'Role Updated',
      'Your account role has been updated to ' || (NEW.raw_user_meta_data->>'role'),
      'role_change',
      jsonb_build_object(
        'old_role', (OLD.raw_user_meta_data->>'role'),
        'new_role', (NEW.raw_user_meta_data->>'role')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;