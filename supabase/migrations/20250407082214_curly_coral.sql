/*
  # Fix Business Roles Display

  1. Changes
    - Add helper functions to set and retrieve business roles properly
    - Ensure all business creators are correctly marked as owners
    - Fix any missing role assignments
    - Create functions to support proper role management

  2. Security
    - Use SECURITY DEFINER to ensure proper access control
    - Include proper validation in role management functions
*/

-- First check if any business has NULL created_by and fix it (without using joined_at)
UPDATE businesses
SET created_by = (
  SELECT user_id 
  FROM business_members 
  WHERE business_id = businesses.id 
  LIMIT 1
)
WHERE created_by IS NULL
AND EXISTS (
  SELECT 1 
  FROM business_members 
  WHERE business_id = businesses.id
);

-- Fix business creator's role to be owner
DO $$
DECLARE
  business_record RECORD;
BEGIN
  FOR business_record IN 
    SELECT id, created_by 
    FROM businesses
    WHERE created_by IS NOT NULL
  LOOP
    INSERT INTO business_user_roles (business_id, user_id, role)
    VALUES (business_record.id, business_record.created_by, 'owner'::business_role)
    ON CONFLICT (business_id, user_id) 
    DO UPDATE SET role = 'owner'::business_role;
  END LOOP;
END $$;

-- Function to add missing business_user_roles records
CREATE OR REPLACE FUNCTION fix_missing_business_roles()
RETURNS TEXT AS $$
DECLARE
  member_record RECORD;
  roles_added INT := 0;
  roles_fixed INT := 0;
BEGIN
  FOR member_record IN 
    SELECT bm.business_id, bm.user_id
    FROM business_members bm
    LEFT JOIN business_user_roles bur 
      ON bm.business_id = bur.business_id AND bm.user_id = bur.user_id
    WHERE bur.id IS NULL
  LOOP
    IF EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = member_record.business_id
      AND b.created_by = member_record.user_id
    ) THEN
      INSERT INTO business_user_roles (business_id, user_id, role)
      VALUES (member_record.business_id, member_record.user_id, 'owner'::business_role);
      roles_added := roles_added + 1;
    ELSE
      INSERT INTO business_user_roles (business_id, user_id, role)
      VALUES (member_record.business_id, member_record.user_id, 'employee'::business_role);
      roles_added := roles_added + 1;
    END IF;
  END LOOP;

  -- Fix any owner mismatches
  UPDATE business_user_roles bur
  SET role = 'owner'::business_role
  FROM businesses b
  WHERE bur.business_id = b.id
  AND bur.user_id = b.created_by
  AND bur.role != 'owner'::business_role;

  GET DIAGNOSTICS roles_fixed = ROW_COUNT;

  RETURN format('Fixed roles: Added %s missing roles, fixed %s mismatched owner roles', 
                roles_added, roles_fixed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the fixer
SELECT fix_missing_business_roles();

-- Get all business roles for a user
CREATE OR REPLACE FUNCTION get_user_business_roles(p_user_id UUID)
RETURNS TABLE (
  business_id UUID,
  business_name TEXT,
  business_role business_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.name, bur.role
  FROM business_user_roles bur
  JOIN businesses b ON bur.business_id = b.id
  WHERE bur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's role in a specific business
CREATE OR REPLACE FUNCTION get_user_role_in_business(p_user_id UUID, p_business_id UUID)
RETURNS business_role AS $$
DECLARE
  user_role business_role;
BEGIN
  SELECT role INTO user_role
  FROM business_user_roles
  WHERE user_id = p_user_id
  AND business_id = p_business_id;

  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Improved update_business_role with validation
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
  -- Must be the owner of the business
  SELECT EXISTS(
    SELECT 1 
    FROM business_user_roles 
    WHERE business_id = p_business_id 
    AND user_id = auth.uid()
    AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only business owners can update roles'
    );
  END IF;

  -- Check if target user is a member
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

  -- Don't allow downgrading business creator
  IF EXISTS (
    SELECT 1
    FROM businesses
    WHERE id = p_business_id
    AND created_by = p_user_id
  ) AND p_role != 'owner' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cannot change role of business creator from owner'
    );
  END IF;

  -- Perform role change
  INSERT INTO business_user_roles (
    business_id, 
    user_id, 
    role
  ) VALUES (
    p_business_id,
    p_user_id,
    p_role
  )
  ON CONFLICT (business_id, user_id) 
  DO UPDATE SET 
    role = p_role,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Role updated to %s', p_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
