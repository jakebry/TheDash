/*
  # Add Foreign Key for Business Owner

  1. Changes
    - Add foreign key constraint for created_by column in businesses table
    - Add index on created_by column for better performance
    
  2. Security
    - Ensures referential integrity between businesses and profiles
*/

-- Add foreign key constraint
ALTER TABLE businesses
ADD CONSTRAINT businesses_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES profiles(id)
ON DELETE SET NULL;

-- Add index for better join performance
CREATE INDEX IF NOT EXISTS businesses_created_by_idx ON businesses(created_by);