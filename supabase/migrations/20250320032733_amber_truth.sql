/*
  # Initial Schema Setup for Business Dashboard

  1. New Tables
    - `profiles`
      - Extends auth.users with additional user information
      - Stores role and profile data
    - `businesses`
      - Stores business/company information
    - `business_members`
      - Links users to businesses with their roles
    - `time_entries`
      - Tracks employee clock in/out times
    - `chat_messages`
      - Stores company-wide chat messages
    
  2. Security
    - Enable RLS on all tables
    - Set up policies for different role access
    - Secure chat messages within business context
*/
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  avatar_url text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);


-- Create custom types for roles
CREATE TYPE user_role AS ENUM ('admin', 'business', 'user');



-- Create businesses table
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  logo_url text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create business_members table
CREATE TABLE business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role DEFAULT 'user'::user_role,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(business_id, user_id)
);

-- Create time_entries table
CREATE TABLE time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logged in users can access their profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Logged in users can insert their profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Logged in users can update their profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- Profiles policies
CREATE POLICY "Public profiles are viewable by users in same business" ON profiles
  FOR SELECT USING (
    auth.uid() IN (
      SELECT bm.user_id 
      FROM business_members bm
      WHERE bm.business_id IN (
        SELECT business_id 
        FROM business_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Businesses policies
CREATE POLICY "Businesses are viewable by members" ON businesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 
      FROM business_members 
      WHERE business_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create businesses" ON businesses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Business members policies
CREATE POLICY "Members viewable by business members" ON business_members
  FOR SELECT USING (
    business_id IN (
      SELECT business_id 
      FROM business_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can manage members" ON business_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 
      FROM business_members 
      WHERE business_id = business_members.business_id 
      AND user_id = auth.uid() 
      AND role = 'business'
    )
  );

-- Time entries policies
CREATE POLICY "Users can view own time entries" ON time_entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own time entries" ON time_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own time entries" ON time_entries
  FOR UPDATE USING (user_id = auth.uid());

-- Chat messages policies
CREATE POLICY "Users can view messages from their business" ON chat_messages
  FOR SELECT USING (
    business_id IN (
      SELECT business_id 
      FROM business_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their business" ON chat_messages
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT business_id 
      FROM business_members 
      WHERE user_id = auth.uid()
    )
  );

-- Functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
