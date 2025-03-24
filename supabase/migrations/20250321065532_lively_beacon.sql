/*
  # Add Notifications System

  1. New Tables
    - `notifications`
      - Stores user notifications
      - Tracks read status
      - Links to users and businesses
    
  2. Security
    - Enable RLS
    - Users can only view their own notifications
    - Notifications are automatically created through triggers
*/

-- Create notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
CREATE POLICY "Users can view own notifications"
ON notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_business_id uuid DEFAULT NULL
) RETURNS notifications AS $$
DECLARE
  v_notification notifications;
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    metadata,
    business_id
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_metadata,
    p_business_id
  )
  RETURNING * INTO v_notification;
  
  RETURN v_notification;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;