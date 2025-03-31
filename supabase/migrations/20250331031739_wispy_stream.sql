/*
  # Add foreign key from business_members to profiles

  1. Changes
    - Add foreign key constraint between business_members.user_id and profiles.id
    - Enable proper relationship querying between these tables
    
  2. Security
    - Ensures referential integrity between business members and profiles
    - Properly allows for JOIN operations in the API
*/

-- Add foreign key constraint from business_members.user_id to profiles.id
ALTER TABLE public.business_members
ADD CONSTRAINT business_members_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;