-- FUNCTION: update profiles.role from auth.users.metadata

-- First, create the function outside of a DO block
CREATE OR REPLACE FUNCTION update_profile_role()
RETURNS trigger AS $fn$
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    UPDATE profiles
    SET role = NEW.raw_user_meta_data->>'role'
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now use a DO block to safely conditionally create the trigger
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    -- Drop trigger if it already exists
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users';

    -- Create trigger referencing the pre-defined function
    EXECUTE '
      CREATE TRIGGER on_auth_user_updated
      AFTER UPDATE ON auth.users
      FOR EACH ROW
      EXECUTE PROCEDURE update_profile_role()
    ';
  END IF;
END;
$do$;
