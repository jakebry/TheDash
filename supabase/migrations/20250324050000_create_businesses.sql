/*
  Migration: Create businesses table
  Timestamp: 20250324050000

  This migration creates the public.businesses table which is needed before adding foreign key constraints.
*/

CREATE TABLE IF NOT EXISTS public.businesses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_by uuid, -- The user who created the business
  created_at timestamptz DEFAULT now()
);

-- Optional: Create an index on the created_by column for performance
CREATE INDEX IF NOT EXISTS idx_businesses_created_by ON public.businesses(created_by);
