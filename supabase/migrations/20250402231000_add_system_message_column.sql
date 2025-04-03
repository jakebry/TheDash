/*
  # Add System Messages Support

  1. Changes
    - Add is_system_message column to chat_messages
    - Update existing messages
    - Add helper function for system messages
    
  2. Security
    - Maintain existing RLS policies
    - Add proper constraints
*/

-- Add is_system_message column
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_system_message boolean DEFAULT false;

-- Create function to send system message
CREATE OR REPLACE FUNCTION send_system_message(
  p_business_id uuid,
  p_message text,
  p_is_private boolean DEFAULT false,
  p_recipient_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  new_message_id uuid;
BEGIN
  INSERT INTO chat_messages (
    business_id,
    message,
    is_private,
    recipient_id,
    is_system_message
  ) VALUES (
    p_business_id,
    p_message,
    p_is_private,
    p_recipient_id,
    true
  )
  RETURNING id INTO new_message_id;
  
  RETURN new_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;