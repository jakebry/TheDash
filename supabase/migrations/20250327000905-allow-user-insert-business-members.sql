-- Enable RLS if not already (safe to re-run)
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert rows into business_members for themselves
CREATE POLICY "Users can insert themselves into business_members"
  ON public.business_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
