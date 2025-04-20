import { useEffect } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../lib/supabase';
import { refreshSession } from '../../lib/tokenRefresh';

interface PersonalInfoProps {
  fullName: string;
  onFullNameChange: (name: string) => void;
}

const roleColors = {
  admin: 'bg-purple-500',
  business: 'bg-emerald-500',
  user: 'bg-blue-500',
};

export function PersonalInfo({ fullName, onFullNameChange }: PersonalInfoProps) {
  const { user } = useAuth();
  const { role } = useRole(user?.id ?? null);

  useEffect(() => {
    const initializeRole = async () => {
      if (!user?.id) return;

      try {
        if (!user.user_metadata?.role) {
          await refreshSession(supabase);
        }

        const { data: roleData } = await supabase.rpc('get_all_auth_roles');

        if (
          roleData?.profile_role === 'admin' ||
          roleData?.jwt_role === 'admin' ||
          roleData?.user_metadata_role === 'admin'
        ) {
          console.info("User is admin by at least one source");
        }
      } catch (err) {
        console.error("Failed to initialize role:", err);
      }
    };

    initializeRole();
  }, [user]);

  return (
    <div className="bg-highlight-blue/20 border border-highlight-blue/30 rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Personal Info</h2>
        {role && (
          <span className={`text-xs text-white px-2 py-1 rounded ${roleColors[role as keyof typeof roleColors]}`}>
            {role}
          </span>
        )}
      </div>
      <label className="block text-white mb-2">Full Name</label>
      <input
        type="text"
        className="w-full px-4 py-2 rounded bg-light-blue text-white mb-4 focus:outline-none focus:ring-2 focus:ring-coral-orange/30"
        value={fullName}
        onChange={(e) => onFullNameChange(e.target.value)}
      />
    </div>
  );
}
