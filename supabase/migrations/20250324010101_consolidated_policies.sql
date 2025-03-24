-- Consolidated RLS Policies
-- Filename: 20250324010101_consolidated_policies.sql

-- Enable RLS on all relevant tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ===========================
-- PROFILES
-- ===========================

DROP POLICY IF EXISTS "Users can read their profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Users can read their profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ===========================
-- BUSINESS MEMBERS
-- ===========================

DROP POLICY IF EXISTS "Admins can manage all memberships" ON business_members;
DROP POLICY IF EXISTS "Business owners can manage their team" ON business_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON business_members;

CREATE POLICY "Admins can manage all memberships"
  ON business_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Business owners can manage their team"
  ON business_members FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM business_members bm
      JOIN profiles p ON p.id = auth.uid()
      WHERE bm.business_id = business_members.business_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'business'
    )
  );

CREATE POLICY "Users can view their own membership"
  ON business_members FOR SELECT
  USING (user_id = auth.uid());

-- ===========================
-- NOTIFICATIONS
-- ===========================

DROP POLICY IF EXISTS "Users can read their notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can send notifications" ON notifications;

CREATE POLICY "Users can read their notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can send notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ===========================
-- CHAT MESSAGES
-- ===========================

DROP POLICY IF EXISTS "Users can read group chat in their business" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their business" ON chat_messages;
DROP POLICY IF EXISTS "Users can read private messages they're involved in" ON chat_messages;

CREATE POLICY "Users can read group chat in their business"
  ON chat_messages FOR SELECT
  USING (
    is_private = FALSE AND
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = chat_messages.business_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their business"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = chat_messages.business_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read private messages they're involved in"
  ON chat_messages FOR SELECT
  USING (
    is_private = TRUE AND (
      sender_id = auth.uid() OR recipient_id = auth.uid()
    )
  );

  -- Create the function that runs on new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Create the trigger if it doesn't exist
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();
