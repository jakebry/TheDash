/*
  # Create Storage Bucket for Avatars

  1. New Storage
    - Create 'avatars' bucket for storing user profile photos
    
  2. Security
    - Enable public access for viewing avatars
    - Add policies for authenticated users to upload their own avatars
*/

-- Create a new storage bucket for avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Allow authenticated users to upload avatar files
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public access to view avatars
create policy "Anyone can view avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- Allow users to update their own avatars
create policy "Users can update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars' and
  auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatars
create policy "Users can delete their own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars' and
  auth.uid()::text = (storage.foldername(name))[1]
);