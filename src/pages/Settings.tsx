import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { ProfilePhoto } from '../components/settings/ProfilePhoto';
import { PersonalInfo } from '../components/settings/PersonalInfo';
import { Security } from '../components/settings/Security';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_DIMENSION = 1200; // Maximum width/height for displayed image

export default function Settings() {
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function getProfile() {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) {
        toast.error('Error fetching profile');
        return;
      }

      if (data) {
        setFullName(data.full_name || '');
        setAvatarUrl(data.avatar_url);
      }
    }

    getProfile();
  }, [user]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Profile Settings</h1>
        
        <ProfilePhoto 
          avatarUrl={avatarUrl} 
          onPhotoUpdate={setAvatarUrl} 
        />

        <PersonalInfo 
          fullName={fullName}
          onFullNameChange={setFullName}
        />

        <Security />
      </div>
    </Layout>
  );
}