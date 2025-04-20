/*
  Migration: Create businesses table
  Timestamp: 20250324050000

  This migration creates the public.businesses table which is needed before adding foreign key constraints.
*/

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID, -- The user who created the business
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: Create an index on the created_by column for performance
CREATE INDEX IF NOT EXISTS idx_businesses_created_by ON public.businesses(created_by);
