-- Fix role comparisons by casting to text to prevent operator type mismatch errors

-- Rewrite sample policies as needed:
DROP POLICY IF EXISTS "Business users can manage own business" ON public.businesses;
CREATE POLICY "Business users can manage own business" ON public.businesses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.user_id = auth.uid() AND bm.business_id = id AND bm.role::text = 'owner'
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() AND role::text IN ('admin', 'business', 'user')
  );

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() AND role::text IN ('admin', 'business', 'user')
  );