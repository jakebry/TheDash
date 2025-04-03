/*
  # Add image_url column to projects table
  
  1. Changes
    - Adds image_url column to projects table for storing project images
    - A simple alter table statement to add the new column
    
  2. Security
    - No changes to RLS policies or permissions
    - Inherits existing project table security
*/

-- Add image_url column to projects table if it doesn't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update sample projects with stock images if they exist
UPDATE projects
SET image_url = 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80'
WHERE name = 'Riverfront Complex Renovation' AND image_url IS NULL;

UPDATE projects
SET image_url = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80'
WHERE name = 'Highland Towers Construction' AND image_url IS NULL;

UPDATE projects
SET image_url = 'https://images.unsplash.com/photo-1508450859948-4e04fabaa4ea?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80'
WHERE name = 'Oakwood Office Park' AND image_url IS NULL;