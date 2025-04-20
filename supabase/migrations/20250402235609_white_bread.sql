/*
  # Create projects table and relationships

  1. New Tables
    - `projects` - Stores business project information
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `name` (text, not null)
      - `description` (text)
      - `address` (text)
      - `start_date` (timestamptz, default now())
      - `end_date` (timestamptz, nullable)
      - `status` (text, default 'active')
      - `budget` (numeric, nullable)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `projects` table
    - Add policies for business owners and members
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  address text,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  status text DEFAULT 'active',
  budget numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_business_id ON projects(business_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policies for projects

-- Business members can view projects of their business
CREATE POLICY "Users can view projects of their business"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = projects.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- Business owners can insert projects
CREATE POLICY "Business owners can insert projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = projects.business_id
      AND businesses.created_by = auth.uid()
    )
  );

-- Business owners can update projects
CREATE POLICY "Business owners can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = projects.business_id
      AND businesses.created_by = auth.uid()
    )
  );

-- Admins can view all projects
CREATE POLICY "Admins can view all projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'::user_role
    )
  );

-- Insert some sample projects for testing
INSERT INTO projects (business_id, name, description, address, start_date, status)
SELECT 
  id as business_id, 
  'Riverfront Complex Renovation' as name,
  'Complete interior and exterior renovation of the riverfront commercial complex.' as description,
  '123 Riverfront Dr, Portland, OR 97201' as address,
  now() - interval '30 days' as start_date,
  'active' as status
FROM businesses
LIMIT 1;

INSERT INTO projects (business_id, name, description, address, start_date, status)
SELECT 
  id as business_id, 
  'Highland Towers Construction' as name,
  'New residential high-rise construction project in the downtown area.' as description,
  '456 Highland Ave, Seattle, WA 98101' as address,
  now() - interval '60 days' as start_date,
  'active' as status
FROM businesses
LIMIT 1;

INSERT INTO projects (business_id, name, description, address, start_date, status)
SELECT 
  id as business_id, 
  'Oakwood Office Park' as name,
  'Development of a modern office park with sustainable design features.' as description,
  '789 Oakwood Blvd, San Francisco, CA 94107' as address,
  now() - interval '15 days' as start_date,
  'active' as status
FROM businesses
LIMIT 1;