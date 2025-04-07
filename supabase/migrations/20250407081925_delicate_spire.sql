/*
  # Fix Business Role Management

  1. Changes
    - Create a migration to fix business role management
    - Add missing business_user_roles table if it doesn't exist yet
    - Create a trigger to maintain business role when user is added to a business
    
  2. Security
    - Use proper SECURITY DEFINER to ensure secure role management
    - Enforce proper business role validation
*/

-- First create the business_role type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_role') THEN
    CREATE TYPE business_role AS ENUM ('owner', 'supervisor', 'lead', 'employee');
  END IF;
END $$;

-- Create business_user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS business_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  role business_role NOT NULL,
  description text,
  created_at timestamptz DEFAULT timezone('utc', now()),
  updated_at timestamptz DEFAULT timezone('utc', now()),
  UNIQUE(user_id, business_id)
);

-- Add timestamp update trigger
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add the trigger to the table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_update_timestamp'
  ) THEN
    CREATE TRIGGER trg_update_timestamp
    BEFORE UPDATE ON business_user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;

-- Function to handle business role changes 
CREATE OR REPLACE FUNCTION handle_business_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify the user about their new role
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    metadata,
    business_id
  ) VALUES (
    NEW.user_id,
    'Business Role Updated',
    format('Your role in the business has been updated to %s', NEW.role),
    'business_role_change',
    jsonb_build_object(
      'business_id', NEW.business_id,
      'previous_role', OLD.role,
      'new_role', NEW.role
    ),
    NEW.business_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for business role changes
DROP TRIGGER IF EXISTS handle_business_role_change_trigger ON business_user_roles;
CREATE TRIGGER handle_business_role_change_trigger
  AFTER UPDATE OF role ON business_user_roles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION handle_business_role_change();

-- Fix business_user_roles records for existing business members
DO $$
DECLARE
  member_record RECORD;
BEGIN
  -- For each business member without a corresponding business_user_roles record
  FOR member_record IN 
    SELECT bm.business_id, bm.user_id
    FROM business_members bm
    LEFT JOIN business_user_roles bur 
      ON bm.business_id = bur.business_id AND bm.user_id = bur.user_id
    WHERE bur.id IS NULL
  LOOP
    -- Check if the user is the business creator (who should be owner)
    IF EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = member_record.business_id
      AND b.created_by = member_record.user_id
    ) THEN
      -- Insert as owner
      INSERT INTO business_user_roles (business_id, user_id, role)
      VALUES (member_record.business_id, member_record.user_id, 'owner');
    ELSE
      -- Insert as employee (default)
      INSERT INTO business_user_roles (business_id, user_id, role)
      VALUES (member_record.business_id, member_record.user_id, 'employee');
    END IF;
  END LOOP;
END $$;

-- Create or replace the update_business_role function with proper validation
CREATE OR REPLACE FUNCTION update_business_role(
  p_business_id UUID,
  p_user_id UUID,
  p_role business_role
)
RETURNS JSONB AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_has_membership BOOLEAN;
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
  
  -- Check if the target user is a member of the business
  SELECT EXISTS(
    SELECT 1
    FROM business_members
    WHERE business_id = p_business_id AND user_id = p_user_id
  ) INTO v_has_membership;
  
  IF NOT v_has_membership THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User is not a member of this business'
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