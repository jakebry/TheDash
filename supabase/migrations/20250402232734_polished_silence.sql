/*
  # Add Business Owner as Member on Creation

  1. Changes
    - Add trigger to automatically add business creator as member
    - Set proper role for business owner
    - Ensure business owner is always added
    
  2. Security
    - Maintain RLS policies
    - Use security definer for proper access
*/

-- Create function to handle new business creation
CREATE OR REPLACE FUNCTION handle_business_creation()
RETURNS trigger AS $$
BEGIN
  -- Add the business creator as a member with business role
  INSERT INTO public.business_members (
    business_id,
    user_id,
    role
  ) VALUES (
    NEW.id,
    NEW.created_by,
    'business'::user_role
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new business creation
DROP TRIGGER IF EXISTS on_business_created ON public.businesses;
CREATE TRIGGER on_business_created
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION handle_business_creation();

-- Fix any existing businesses that don't have their creator as a member
DO $$ 
DECLARE
  business_record RECORD;
BEGIN
  FOR business_record IN 
    SELECT id, created_by 
    FROM businesses b
    WHERE NOT EXISTS (
      SELECT 1 
      FROM business_members bm 
      WHERE bm.business_id = b.id 
      AND bm.user_id = b.created_by
    )
    AND created_by IS NOT NULL
  LOOP
    INSERT INTO business_members (business_id, user_id, role)
    VALUES (
      business_record.id,
      business_record.created_by,
      'business'::user_role
    )
    ON CONFLICT (business_id, user_id) DO NOTHING;
  END LOOP;
END $$;