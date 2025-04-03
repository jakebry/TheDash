/*
  # Fix Chat Message Relationships and Structure

  1. Changes
    - Ensure chat_messages table has the correct structure
    - Add proper foreign key constraints between chat_messages and profiles
    - Drop and recreate RLS policies to avoid conflicts
    
  2. Security
    - Enable row level security
    - Create appropriate policies for group and private messages
*/

-- First drop any problematic policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read group chat in their business" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can read private messages they're involved in" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their business" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their business" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view messages from their business" ON public.chat_messages;

-- Ensure chat_messages table exists with correct structure
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_private boolean DEFAULT false,
  recipient_id uuid,
  sender_id uuid
);

-- Add explicit foreign key constraints with named relationships
DO $$ 
BEGIN
  -- Add recipient_id foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chat_messages_recipient_id_fkey'
  ) THEN
    ALTER TABLE public.chat_messages
    ADD CONSTRAINT chat_messages_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add sender_id foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chat_messages_sender_id_fkey'
  ) THEN
    ALTER TABLE public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable row level security
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Recreate all necessary policies
-- Users can read group chat in their business
CREATE POLICY "Users can read group chat in their business"
  ON public.chat_messages
  FOR SELECT
  TO public
  USING (
    (is_private = false) AND (
      EXISTS (
        SELECT 1
        FROM business_members
        WHERE business_members.business_id = chat_messages.business_id
        AND business_members.user_id = auth.uid()
      )
    )
  );

-- Users can read private messages they're involved in
CREATE POLICY "Users can read private messages they're involved in"
  ON public.chat_messages
  FOR SELECT
  TO public
  USING (
    (is_private = true) AND (
      (sender_id = auth.uid()) OR (recipient_id = auth.uid())
    )
  );

-- Users can send messages in their business
CREATE POLICY "Users can send messages in their business"
  ON public.chat_messages
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM business_members
      WHERE business_members.business_id = chat_messages.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- Users can send messages to their business
CREATE POLICY "Users can send messages to their business"
  ON public.chat_messages
  FOR INSERT
  TO public
  WITH CHECK (
    business_id IN (
      SELECT business_members.business_id
      FROM business_members
      WHERE business_members.user_id = auth.uid()
    )
  );

-- Users can view messages from their business
CREATE POLICY "Users can view messages from their business"
  ON public.chat_messages
  FOR SELECT
  TO public
  USING (
    business_id IN (
      SELECT business_members.business_id
      FROM business_members
      WHERE business_members.user_id = auth.uid()
    )
  );