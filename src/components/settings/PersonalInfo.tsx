import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface PersonalInfoProps {
  fullName: string;
  onFullNameChange: (name: string) => void;
}

const roleColors = {
  admin: 'bg-purple-500',
  business: 'bg-emerald-500',
  user: 'bg-blue-500'
};

export function PersonalInfo({ fullName, onFullNameChange }: PersonalInfoProps) {
  const { user } = useAuth();
  const [role, setRole] = useState<'admin' | 'business' | 'user'>('user');

  useEffect(() => {
    async function fetchRole() {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && data?.role) {
        setRole(data.role);
      }
    }

    fetchRole();
  }, [user]);

  const updateProfile = async () => {
    try {
      if (!user?.id) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Error updating profile');
    }
  };

  return (
    <div className="bg-highlight-blue rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-md text-xs font-medium text-white ${roleColors[role]}`}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            onBlur={updateProfile}
            className="w-full px-3 py-2 bg-dark-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={user?.email}
            disabled
            className="w-full px-3 py-2 bg-dark-blue border border-gray-600 rounded-lg text-gray-400"
          />
          <p className="mt-2 text-sm text-gray-400">
            Email cannot be changed. Contact support if you need to update it.
          </p>
        </div>
      </div>
    </div>
  );
}