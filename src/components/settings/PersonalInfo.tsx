import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

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
  const { role, loading: roleLoading, refreshRole } = useRole(user?.id ?? null);
  const [updating, setUpdating] = useState(false);
  const [displayRole, setDisplayRole] = useState<string | null>(null);

  useEffect(() => {
    // Force refresh the role to ensure we have the latest
    const updateRole = async () => {
      await refreshRole();
      
      // Get the most accurate role from all sources
      try {
        const { data } = await supabase.rpc('get_all_auth_roles');
        
        if (data) {
          // Use the highest privilege role from any source
          if (data.is_admin_in_jwt || 
              data.is_admin_in_profile || 
              data.is_admin_in_user_metadata ||
              data.is_admin_in_app_metadata) {
            setDisplayRole('admin');
          } else if (data.profile_role === 'business' || 
                  data.user_metadata_role === 'business' || 
                  data.app_metadata_role === 'business' ||
                  data.jwt_role === 'business') {
            setDisplayRole('business');
          } else {
            setDisplayRole('user');
          }
        } else {
          setDisplayRole(role);
        }
      } catch (error) {
        console.error('Error getting all roles:', error);
        setDisplayRole(role);
      }
    };
    
    updateRole();
  }, [role]);

  const updateProfile = async () => {
    try {
      if (!user?.id) return;
      
      setUpdating(true);
      
      // Update the profile directly in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Update profile error:', err);
      toast.error('Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-highlight-blue rounded-xl p-6 mb-6 space-y-4">
      <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>
      
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${roleColors[displayRole as keyof typeof roleColors] || 'bg-gray-500'}`} />
        <p className="text-sm text-gray-400">
          {roleLoading ? 'Loading role...' : `Role: ${displayRole || 'user'}`}
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-2">Full Name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          className="w-full px-4 py-2 rounded bg-light-blue border border-gray-600 text-white"
        />
      </div>

      <button
        onClick={updateProfile}
        disabled={updating}
        className="px-4 py-2 bg-neon-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updating ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}