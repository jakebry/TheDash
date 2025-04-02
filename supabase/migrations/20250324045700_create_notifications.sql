/*
  Migration: Create notifications table
  Timestamp: 20250324045700

  This migration creates the public.notifications table which is needed for subsequent policies.
*/

CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id uuid NOT NULL,
  message TEXT NOT NULL,
  created_at timestamptz DEFAULT now()
);
