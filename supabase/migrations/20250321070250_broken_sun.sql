/*
  # Add Business Fields

  1. Changes
    - Add phone number, address, and website fields to businesses table
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS website text;