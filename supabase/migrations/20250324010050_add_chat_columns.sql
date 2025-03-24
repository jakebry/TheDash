ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES profiles(id);

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES profiles(id);

