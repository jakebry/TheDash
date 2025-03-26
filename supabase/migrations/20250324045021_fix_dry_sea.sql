-- 20250324045020_dry_sea.sql FIXED VERSION
-- Add function to update profile role with a fixed search_path and correct INSERT syntax

CREATE OR REPLACE FUNCTION public.update_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      'Role Changed',
      'Your role has been updated to ' || (NEW.raw_user_meta_data->>'role'),
      'role_update',
      jsonb_build_object(
        'new_role', (NEW.raw_user_meta_data->>'role'),
        'previous_role', (OLD.raw_user_meta_data->>'role')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
