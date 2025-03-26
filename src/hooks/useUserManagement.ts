import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Business, User } from '../types/admin';

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [updatingRoles, setUpdatingRoles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchUsers();
    fetchBusinesses();

    const profilesSubscription = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      profilesSubscription.unsubscribe();
    };
  }, []);

  async function fetchBusinesses() {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name');

      if (error) throw error;
      setBusinesses(data || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast.error('Failed to load businesses');
    }
  }

  async function fetchUsers() {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);

      let success = false;

      try {
        const { data: adminListData, error: adminListError } = await supabase.rpc('admin_list_all_profiles');

        if (!adminListError && adminListData && adminListData.length > 0) {
          const usersWithBusinesses = await addBusinessesToUsers(adminListData);
          setUsers(usersWithBusinesses);
          success = true;
          return;
        }
      } catch (adminListErr) {
        console.warn('admin_list_all_profiles failed:', adminListErr);
      }

      if (!success) {
        try {
          const { data: usersData, error: usersError } = await supabase.rpc('list_users_with_businesses');

          if (!usersError && usersData) {
            const formattedUsers = usersData.map((user: any): User => ({
              id: user.user_id,
              email: user.email,
              full_name: user.full_name,
              role: user.role as 'admin' | 'business' | 'user',
              created_at: user.created_at,
              businesses: user.businesses ? JSON.parse(JSON.stringify(user.businesses)) : []
            }));

            setUsers(formattedUsers);
            success = true;
            return;
          }
        } catch (rpcError) {
          console.warn('list_users_with_businesses failed:', rpcError);
        }
      }

      if (!success) {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, role, full_name, email, created_at')
            .order('created_at', { ascending: false });

          if (!profilesError && profilesData) {
            const usersWithBusinesses = await addBusinessesToUsers(profilesData);
            setUsers(usersWithBusinesses);
            setDebugInfo('Retrieved users directly from profiles table. You may need to verify admin access for complete data.');
            success = true;
            return;
          }
        } catch (profilesErr) {
          console.warn('Direct profiles query failed:', profilesErr);
        }
      }

      if (!success) {
        setError('Failed to load user data. Please verify admin access and try again.');
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
      setError(`Failed to load user data: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function addBusinessesToUsers(users: any[]): Promise<User[]> {
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from('business_members')
        .select('user_id, business_id');

      if (membershipError) throw membershipError;

      const { data: allBusinesses, error: businessError } = await supabase
        .from('businesses')
        .select('id, name');

      if (businessError) throw businessError;

      return users.map((user: any): User => {
        const userBusinessIds = memberships
          ?.filter(m => m.user_id === user.id)
          .map(m => m.business_id) || [];

        const userBusinesses = allBusinesses
          ?.filter(b => userBusinessIds.includes(b.id))
          .map(b => ({
            id: b.id,
            name: b.name
          })) || [];

        return {
          ...user,
          businesses: userBusinesses
        };
      });
    } catch (error) {
      console.warn('Error adding businesses to users:', error);
      return users.map((user: any): User => ({
        ...user,
        businesses: []
      }));
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
  };

  async function updateUserRole(userId: string, newRole: 'admin' | 'business' | 'user') {
    try {
      setUpdatingRoles({ ...updatingRoles, [userId]: true });

      const { error: userError } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', userId)
  .single();

if (userError) throw userError;


      // (previousRole not used — removed)


      const { data: updateResult, error: updateError } = await supabase.rpc('update_user_role_with_validation', {
        target_user_id: userId,
        new_role: newRole
      });

      if (updateError) throw updateError;
      if (!updateResult?.success) throw new Error(updateResult?.error || 'Role update failed');

      await supabase.auth.refreshSession();
      await supabase.rpc('force_jwt_refresh');

      setUsers(users.map(user =>
        user.id === userId ? { ...user, role: newRole } : user
      ));

      // TODO: Restore notification after fixing backend SQL error with ambiguous `user_id`
      /*
      await supabase
        .from('notifications')
        .insert({
          user_id: currentUser?.id,
          title: 'Role Update Completed',
          message: `${userData?.full_name || userData?.email || 'User'}'s role was updated to ${newRole}`,
          type: 'role_change',
          metadata: {
            affected_user: userId,
            previous_role: previousRole,
            new_role: newRole
          }
        });
      */

      toast.success('User role updated successfully');
      if (newRole === 'business') {
        toast.success('Business role activated! Click the notification to create your first business.');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    } finally {
      setUpdatingRoles({ ...updatingRoles, [userId]: false });
    }
  }

  async function assignUserToBusiness(userId: string, businessId: string) {
    try {
      const { data: existing } = await supabase
        .from('business_members')
        .select('id')
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .single();

      if (existing) {
        toast.error('User is already a member of this business');
        return;
      }

      const { error } = await supabase
        .from('business_members')
        .insert({ user_id: userId, business_id: businessId });

      if (error) throw error;
      await fetchUsers();
      toast.success('User assigned to business successfully');
    } catch (error) {
      toast.error('Failed to assign user to business');
    }
  }

  const verifyAdminAccess = async () => {
    try {
      setVerifying(true);
      setDebugInfo('Verifying admin access...');

      await supabase.rpc('ensure_profile_exists', { check_all: true });
      setDebugInfo('Step 1: Ensured all profiles exist');

      const { data: repairData } = await supabase.rpc('repair_admin_visibility');
      setDebugInfo(`Step 2: ${repairData || 'Repaired admin visibility'}`);

      const { data: fixAppData } = await supabase.rpc('fix_admin_app_metadata');
      setDebugInfo(`Step 3: ${fixAppData || 'Updated app metadata'}`);

      const { data: jwtData } = await supabase.rpc('force_jwt_refresh');
      setDebugInfo(`Step 4: ${jwtData || 'Forced JWT refresh'}`);

      const { data: profileFixData } = await supabase.rpc('fix_admin_profile_access');
      setDebugInfo(`Step 5: ${profileFixData || 'Fixed admin profile access'}`);

      const { data: diagData } = await supabase.rpc('get_admin_diagnostic_info');

      await fetchUsers();

      const isAdminInJwt = diagData?.roles?.is_admin_in_jwt === true;
      const isAdminInProfile = diagData?.roles?.is_admin_in_profile === true;

      setDebugInfo(`Admin access verification complete. JWT admin: ${isAdminInJwt || false}, 
        Profile admin: ${isAdminInProfile || false}.
        You may need to log out and log back in for all changes to take effect.`);

      toast.success('Admin access verification completed');

      if (!isAdminInJwt && isAdminInProfile) {
        toast.error('Your JWT token does not have admin role. Please log out and log back in.', {
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error verifying admin access:', error);
      toast.error('Failed to verify admin access');
      setDebugInfo('Failed to verify admin access. Try logging out and logging back in.');
    } finally {
      setVerifying(false);
    }
  };

  return {
    users,
    businesses,
    loading,
    refreshing,
    verifying,
    error,
    debugInfo,
    updatingRoles,
    handleRefresh,
    updateUserRole,
    assignUserToBusiness,
    verifyAdminAccess,
  };
}
