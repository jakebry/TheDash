import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { refreshSession } from '../lib/tokenRefresh';
import toast from 'react-hot-toast';

export type User = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'admin' | 'business' | 'user';
};

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRoles, setUpdatingRoles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      setUsers(data as User[]);
    } catch (err: any) {
      console.error('Error fetching users:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: 'admin' | 'business' | 'user') {
    try {
      setUpdatingRoles(prev => ({ ...prev, [userId]: true }));

      const { error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (checkError) throw checkError;

      const { data, error } = await supabase.rpc('update_user_role_with_validation', {
        target_user_id: userId,
        new_role: newRole
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Role update failed');
      }

      // Use throttled token refresh
      await refreshSession(supabase);
      await supabase.rpc('sync_profile_role_to_auth');
      
      // Throttled refresh again to ensure JWT is updated
      await refreshSession(supabase);
      await supabase.rpc('force_jwt_refresh');

      // Update local state
      setUsers(prev =>
        prev.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );

      toast.success(`User promoted to ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update user role');
    } finally {
      setUpdatingRoles(prev => ({ ...prev, [userId]: false }));
    }
  }

  return {
    users,
    loading,
    updatingRoles,
    fetchUsers,
    updateUserRole
  };
}