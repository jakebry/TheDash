-- 0043_fix_function_permissions.sql
-- Fix permission errors when calling update_user_role_with_validation via RPC

-- Ensure the function runs with elevated privileges
ALTER FUNCTION update_user_role_with_validation(UUID, TEXT) SECURITY DEFINER;

-- Ensure it's owned by postgres for elevated access to auth.users
ALTER FUNCTION update_user_role_with_validation(UUID, TEXT) OWNER TO postgres;

-- Allow authenticated users to execute the function
GRANT EXECUTE ON FUNCTION update_user_role_with_validation(UUID, TEXT) TO authenticated;
