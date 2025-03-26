/*
  # Add notification delete policies

  1. Changes
    - Add DELETE policies for notifications table
    - Fix notification permissions

  2. Security
    - Ensure users can only delete their own notifications
*/

-- Create delete policy for notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());