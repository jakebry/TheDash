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
  const { user } = useAuth();

  useEffect(() => {
    async function getProfile() {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setAvatarUrl(data.avatar_url);
      }
    }

    getProfile();
  }, [user]);

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-neon-blue/20 flex items-center justify-center overflow-hidden`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Profile"
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xl text-white">
          {user?.email?.[0].toUpperCase()}
        </span>
      )}
    </div>
  );
}