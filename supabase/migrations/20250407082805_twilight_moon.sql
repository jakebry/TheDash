/*
  # Add Safe Business Deletion Function

  1. Changes
    - Add delete_business RPC function for secure business deletion
    - Add security checks to ensure only admins can delete businesses
    - Cascade deletion to all related business data

  2. Security
    - Require admin authentication
    - Add transaction to ensure data consistency
    - Validate required parameters
    - Two-level validation for sensitive operation
*/

-- Create function to delete a business and all associated data
CREATE OR REPLACE FUNCTION delete_business(
  p_business_id UUID,
  p_confirmation_phrase TEXT,
  p_verification_phrase TEXT
)
RETURNS JSONB AS $$
DECLARE
  expected_phrase CONSTANT TEXT := 'DELETE';
  expected_verification_phrase CONSTANT TEXT := 'CONFIRM DELETE';
  business_name TEXT;
  deleted_business_id UUID;
  is_admin BOOLEAN;
  result JSONB;
BEGIN
  -- Check if user has admin permissions
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() 
    AND role = 'admin'::user_role
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only administrators can delete businesses'
    );
  END IF;

  -- Check confirmation phrases
  IF p_confirmation_phrase IS NULL OR p_confirmation_phrase != expected_phrase THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid confirmation phrase. Please type "DELETE" to confirm.'
    );
  END IF;
  
  IF p_verification_phrase IS NULL OR p_verification_phrase != expected_verification_phrase THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid verification phrase. Please type "CONFIRM DELETE" to verify.'
    );
  END IF;
  
  -- Get business name for the response
  SELECT name INTO business_name
  FROM businesses
  WHERE id = p_business_id;
  
  IF business_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Business not found'
    );
  END IF;
  
  -- Begin transaction for data consistency
  BEGIN
    -- Delete business and let CASCADE take care of related tables
    DELETE FROM businesses
    WHERE id = p_business_id
    RETURNING id INTO deleted_business_id;
    
    -- Create delete notification for all affected users
    -- First get all users who were members of this business
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type, 
      metadata
    )
    SELECT 
      user_id,
      'Business Deleted',
      format('The business "%s" has been deleted by an administrator', business_name),
      'business_deleted',
      jsonb_build_object(
        'business_id', p_business_id,
        'business_name', business_name
      )
    FROM business_members
    WHERE business_id = p_business_id;
    
    -- If deletion was successful
    IF deleted_business_id IS NOT NULL THEN
      -- Log the deletion (notify admin)
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        metadata
      ) VALUES (
        auth.uid(),
        'Business Deleted',
        format('You successfully deleted the business "%s"', business_name),
        'business_deleted',
        jsonb_build_object(
          'business_id', p_business_id,
          'business_name', business_name,
          'deleted_by', auth.uid(),
          'deleted_at', now()
        )
      );
      
      result := jsonb_build_object(
        'success', true,
        'message', format('Business "%s" and all associated data have been permanently deleted', business_name),
        'business_id', p_business_id,
        'business_name', business_name
      );
    ELSE
      result := jsonb_build_object(
        'success', false,
        'message', 'Failed to delete business'
      );
    END IF;
    
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error and return failure response
      RAISE NOTICE 'Error deleting business: %', SQLERRM;
      
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Error: %s', SQLERRM)
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;