import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { ProfilePhoto } from '../components/settings/ProfilePhoto';
import { PersonalInfo } from '../components/settings/PersonalInfo';
import { Security } from '../components/settings/Security';
import { PromoteToAdminButton } from '../components/admin/PromoteToAdminButton';

export default function Settings() {
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, signOut } = useAuth();

  useEffect(() => {
    async function getProfile() {
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Start with user metadata (this doesn't require an API call)
        if (user.user_metadata?.full_name) {
          setFullName(user.user_metadata.full_name);
          setIsLoading(false);
        }
        
        if (user.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
          setIsLoading(false);
        }
        
        // Single efficient query to get profile data
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          setError('Error loading profile data. Please try again.');
          throw error;
        }

        if (data) {
          setFullName(data.full_name || '');
          setAvatarUrl(data.avatar_url);
        }
      } catch (error) {
        console.error('Error in profile fetch:', error);
        setError('Failed to load profile data. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    }

    getProfile();
  }, [user]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Profile Settings</h1>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-white">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="bg-highlight-blue rounded-xl p-6 animate-pulse">
            <div className="h-6 w-1/3 bg-light-blue rounded mb-4"></div>
            <div className="h-24 w-24 bg-light-blue rounded-full mb-4"></div>
            <div className="h-8 w-full bg-light-blue rounded mb-2"></div>
            <div className="h-8 w-2/3 bg-light-blue rounded"></div>
          </div>
        ) : (
          <>
            <ProfilePhoto 
              avatarUrl={avatarUrl} 
              onPhotoUpdate={setAvatarUrl} 
            />

            <PersonalInfo 
              fullName={fullName}
              onFullNameChange={setFullName}
            />

            <Security />
            
            {/* Admin promotion button remains but is hidden to regular users by its internal logic */}
            <div className="hidden">
              <PromoteToAdminButton />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}