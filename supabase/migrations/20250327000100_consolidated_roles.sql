
-- ================================================
--  Consolidated Migration: Role Management + RLS
--  Roles: Admin | Business | User
--  Authoritative Source: auth.users.raw_app_meta_data.role
-- ================================================

-- 1. Add role to profiles if not already exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;

-- 2. Function: Check if user is admin based on JWT
CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS BOOLEAN AS $$
DECLARE
  claims JSONB;
BEGIN
  claims := auth.jwt();
  RETURN (claims -> 'role')::TEXT = '"Admin"';
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Function: Get current user's UID from JWT
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'sub')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Function: Sync profile.role with raw_app_meta_data.role
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS VOID AS $$
DECLARE
  uid UUID;
  jwt_role TEXT;
BEGIN
  uid := current_user_id();
  SELECT raw_app_meta_data->>'role'
  INTO jwt_role
  FROM auth.users
  WHERE id = uid;

  UPDATE public.profiles
  SET role = jwt_role
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Secure RPC: Admin can update any user's role
CREATE OR REPLACE FUNCTION public.update_user_role_with_validation(
  target_user_id UUID,
  new_role TEXT
)
RETURNS TEXT AS $$
DECLARE
  current_uid UUID := current_user_id();
  current_role TEXT;
BEGIN
  -- Check that the current user is an Admin
  SELECT u.raw_app_meta_data ->> 'role'
  INTO current_role
  FROM auth.users u
  WHERE u.id = current_uid;

  IF current_role != 'Admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Update auth.users
  UPDATE auth.users u
  SET raw_app_meta_data = jsonb_set(u.raw_app_meta_data, '{role}', to_jsonb(new_role::TEXT))
  WHERE u.id = target_user_id;

  -- Update profiles table
  UPDATE public.profiles p
  SET role = new_role
  WHERE p.id = target_user_id;

  RETURN 'Role updated successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Policy: Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = current_user_id());

-- 8. Policy: Users can update their own profile (except role)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = current_user_id())
  WITH CHECK (id = current_user_id() AND role = role); -- Cannot change role

-- 9. Policy: Admins can read and update all
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles
  FOR ALL
  USING (is_admin_jwt())
  WITH CHECK (is_admin_jwt());

-- 10. View: Debug user roles (optional)
CREATE OR REPLACE VIEW public.user_roles_debug AS
SELECT
  u.id AS user_id,
  p.role AS profile_role,
  u.raw_app_meta_data ->> 'role' AS auth_role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id;

-- 11. Future-Proof: Trigger to sync role on profile insert (optional)
DROP TRIGGER IF EXISTS sync_profile_role_trigger ON public.profiles;
CREATE OR REPLACE FUNCTION sync_profile_role_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_profile_role();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_profile_role_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_role_trigger_fn();

-- Done ✅
