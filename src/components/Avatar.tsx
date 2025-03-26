import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabase';

interface AvatarProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-24 h-24',
};

export function Avatar({ size = 'sm' }: AvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function getProfile() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // First check if we already have the avatar in user metadata
        // This avoids unnecessary database queries
        if (user.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
          setIsLoading(false);
          return;
        }
        
        // Use the secure RPC function to get avatar URL
        const { data, error } = await supabase
          .rpc('get_user_avatar', { user_id: user.id });

        if (error) {
          console.error('Error fetching avatar:', error);
          // Fallback to trying profile query directly
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .maybeSingle();
            
          if (!profileError && profileData?.avatar_url) {
            setAvatarUrl(profileData.avatar_url);
          }
        } else if (data) {
          setAvatarUrl(data);
        }
      } catch (error) {
        console.error('Exception in avatar fetch:', error);
      } finally {
        setIsLoading(false);
      }
    }

    getProfile();
  }, [user]);

  // Get the first initial from email or full name
  const getInitial = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name[0].toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || '?';
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-neon-blue/20 flex items-center justify-center overflow-hidden`}>
      {isLoading ? (
        <div className="animate-pulse w-full h-full bg-light-blue/50"></div>
      ) : avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Profile"
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xl text-white">
          {getInitial()}
        </span>
      )}
    </div>
  );
}