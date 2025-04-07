-- migrate:up
create or replace function public.update_user_role_with_validation(
  target_user_id uuid,
  new_role text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
  current_user_role user_role;
  target_user_name TEXT;
  target_user_email TEXT;
  valid_role BOOLEAN;
  current_role user_role;
begin
  -- Check if the current user is an admin
  select role into current_user_role
  from profiles
  where id = auth.uid();

  if current_user_role != 'admin'::user_role then
    return jsonb_build_object(
      'success', false,
      'error', 'Only administrators can change user roles',
      'status', 403
    );
  end if;

  -- Validate that the new role is a valid enum
  select exists (
    select 1 from pg_enum
    where enumlabel = new_role
      and enumtypid = 'user_role'::regtype::oid
  ) into valid_role;

  if not valid_role then
    return jsonb_build_object(
      'success', false,
      'error', format('Invalid role: %s', new_role),
      'status', 400
    );
  end if;

  -- Get target user info and current role
  select full_name, email, role into target_user_name, target_user_email, current_role
  from profiles
  where id = target_user_id;

  -- Only update if the role is actually different
  if current_role != new_role::user_role then
    update profiles
    set role = new_role::user_role
    where id = target_user_id;
  end if;

  -- Update auth.users metadata
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  where id = target_user_id;

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', format('Role updated to %s for %s', new_role, coalesce(target_user_name, target_user_email, 'user')),
    'user_id', target_user_id,
    'new_role', new_role
  );

  return result;

exception
  when others then
    return jsonb_build_object(
      'success', false,
      'error', sqlerrm,
      'status', 500
    );
end;
$$;

-- migrate:down
drop function if exists public.update_user_role_with_validation(uuid, text);
