/*
  # Add read status to chat messages

  1. Changes
    - Add read column to chat_messages table
    - Add function to mark messages as read
    - Add function to get unread count
    
  2. Security
    - Use security definer for functions
    - Maintain existing RLS policies
*/

-- Add read column to chat_messages
ALTER TABLE chat_messages
ADD COLUMN read boolean DEFAULT false;

-- Create index for better performance
CREATE INDEX idx_chat_messages_read ON chat_messages(read);

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_business_id uuid,
  p_recipient_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE chat_messages
  SET read = true
  WHERE business_id = p_business_id
  AND (
    (is_private = true AND recipient_id = p_recipient_id)
    OR
    (is_private = false)
  )
  AND read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread count for a business
CREATE OR REPLACE FUNCTION get_business_unread_count(
  p_business_id uuid,
  p_user_id uuid
)
RETURNS integer AS $$
DECLARE
  unread_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO unread_count
  FROM chat_messages
  WHERE business_id = p_business_id
  AND read = false
  AND (
    (is_private = true AND recipient_id = p_user_id)
    OR
    (is_private = false)
  )
  AND sender_id != p_user_id;
  
  RETURN unread_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;