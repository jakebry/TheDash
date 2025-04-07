/*
  # Add business role management

  1. New Functions
    - `update_business_role` - Function to update a user's business-specific role
    
  2. Changes
    - Add function to manage business roles
    - Ensure business role defaults to 'employee' if not set
    
  3. Security
    - Use SECURITY DEFINER to ensure proper access control
    - Only business owners can update business roles
*/

-- Function to update a user's business role
CREATE OR REPLACE FUNCTION update_business_role(
  p_business_id UUID,
  p_user_id UUID,
  p_role business_role
)
RETURNS JSONB AS $$
DECLARE
  v_is_owner BOOLEAN;
  result JSONB;
BEGIN
  -- Check if the current user is the business owner
  SELECT EXISTS(
    SELECT 1 
    FROM businesses 
    WHERE id = p_business_id AND created_by = auth.uid()
  ) INTO v_is_owner;
  
  -- Only proceed if user is the business owner
  IF NOT v_is_owner THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only business owners can update roles'
    );
  END IF;
  
  -- First check if a role record already exists
  IF EXISTS (
    SELECT 1 
    FROM business_user_roles
    WHERE business_id = p_business_id AND user_id = p_user_id
  ) THEN
    -- Update existing role
    UPDATE business_user_roles
    SET role = p_role, 
        updated_at = now()
    WHERE business_id = p_business_id AND user_id = p_user_id;
  ELSE
    -- Insert new role record
    INSERT INTO business_user_roles (
      business_id, 
      user_id, 
      role
    ) VALUES (
      p_business_id,
      p_user_id,
      p_role
    );
  END IF;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Role updated to %s', p_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default role setting function for business members
CREATE OR REPLACE FUNCTION set_default_business_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If the business_user_roles record doesn't exist yet, create it with default 'employee' role
  IF NOT EXISTS (
    SELECT 1 
    FROM business_user_roles
    WHERE business_id = NEW.business_id AND user_id = NEW.user_id
  ) THEN
    -- And the member is not the business creator (who should be owner)
    IF NOT EXISTS (
      SELECT 1
      FROM businesses
      WHERE id = NEW.business_id AND created_by = NEW.user_id
    ) THEN
      -- Insert with employee role
      INSERT INTO business_user_roles (
        business_id,
        user_id,
        role
      ) VALUES (
        NEW.business_id,
        NEW.user_id,
        'employee'::business_role
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to set default business role
DROP TRIGGER IF EXISTS set_default_business_role_trigger ON business_members;
CREATE TRIGGER set_default_business_role_trigger
  BEFORE INSERT ON business_members
  FOR EACH ROW
  EXECUTE FUNCTION set_default_business_role();

-- Set business creator as owner when business is created
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
  
  -- Also set the business creator as owner in business_user_roles
  INSERT INTO public.business_user_roles (
    business_id,
    user_id,
    role
  ) VALUES (
    NEW.id,
    NEW.created_by,
    'owner'::business_role
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;