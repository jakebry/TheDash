import { useState } from 'react';
import { Search, RefreshCw, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { refreshSession } from '../../lib/tokenRefresh';
import { UserList } from './UserList';
import { StatusMessages } from './StatusMessages';

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [updatingRoles, setUpdatingRoles] = useState<Record<string, boolean>>({});
  // const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
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
          console.log(`Successfully loaded ${usersWithBusinesses.length} users via admin_list_all_profiles`);
          return;
        }
      } catch (adminListErr) {
        console.warn('admin_list_all_profiles failed:', adminListErr);
      }

      if (!success) {
        try {
          const { data: usersData, error: usersError } = await supabase.rpc('list_users_with_businesses');
          if (!usersError && usersData) {
            const formattedUsers = usersData.map((user: any) => ({
              id: user.user_id,
              email: user.email,
              full_name: user.full_name,
              role: user.role as 'admin' | 'business' | 'user',
              created_at: user.created_at,
              businesses: user.businesses ? JSON.parse(JSON.stringify(user.businesses)) : []
            }));
            setUsers(formattedUsers);
            success = true;
            console.log(`Successfully loaded ${formattedUsers.length} users via list_users_with_businesses`);
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
            setDebugInfo("Retrieved users directly from profiles table. You may need to verify admin access for complete data.");
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
  };

  async function addBusinessesToUsers(users: any[]): Promise<any[]> {
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from('business_members')
        .select('user_id, business_id');

      if (membershipError) throw membershipError;

      const { data: allBusinesses, error: businessError } = await supabase
        .from('businesses')
        .select('id, name');

      if (businessError) throw businessError;

      return users.map(user => {
        const userBusinessIds = memberships?.filter(m => m.user_id === user.id).map(m => m.business_id) || [];
        const userBusinesses = allBusinesses?.filter(b => userBusinessIds.includes(b.id)).map(b => ({
          id: b.id,
          name: b.name
        })) || [];
        return { ...user, businesses: userBusinesses };
      });
    } catch (error) {
      console.warn('Error adding businesses to users:', error);
      return users.map(user => ({ ...user, businesses: [] }));
    }
  }

  const fetchBusinesses = async () => {
    try {
      const { data, error } = await supabase.from('businesses').select('id, name');
      if (error) throw error;
      setBusinesses(data || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast.error('Failed to load businesses');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    await fetchBusinesses();
  };

  async function updateUserRole(userId: string, newRole: 'admin' | 'business' | 'user') {
    try {
      setUpdatingRoles({ ...updatingRoles, [userId]: true });

      const { error: userError } = await supabase
        .from('profiles')
        .select('role, email, full_name')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // const previousRole = userData?.role || 'user';

      const { data: updateResult, error: updateError } = await supabase.rpc('update_user_role_safely', {
        target_user_id: userId,
        new_role: newRole
      });

      if (updateError) throw updateError;
      if (!updateResult?.success) throw new Error(updateResult?.error || 'Role update failed');

      await refreshSession(supabase);
      await new Promise(resolve => setTimeout(resolve, 250));
      await supabase.auth.getUser(); // Optional: pull updated JWT info

      setUsers(users.map(user => user.id === userId ? { ...user, role: newRole } : user));

      toast.success('User role updated successfully');

      if (newRole === 'business') {
        toast.success('Business role activated! Click the notification to create your first business.');
      }
    } catch (error: any) {
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
      await refreshSession(supabase);
      setDebugInfo('Step 1: Refreshed auth token');
      await supabase.rpc('ensure_profile_exists', { check_all: true });
      setDebugInfo('Step 2: Ensured all profiles exist');
      const { data: repairData } = await supabase.rpc('repair_admin_visibility');
      setDebugInfo(`Step 3: ${repairData || 'Repaired admin visibility'}`);
      const { data: fixAppData } = await supabase.rpc('fix_admin_app_metadata');
      setDebugInfo(`Step 4: ${fixAppData || 'Updated app metadata'}`);
      await refreshSession(supabase);
      const { data: profileFixData } = await supabase.rpc('fix_admin_profile_access');
      setDebugInfo(`Step 6: ${profileFixData || 'Fixed admin profile access'}`);
      const { data: diagData } = await supabase.rpc('get_admin_diagnostic_info');
      await fetchUsers();
      await fetchBusinesses();

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

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-highlight-blue rounded-xl p-6 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">User Management</h2>
        <div className="flex gap-2">
          <button
            onClick={verifyAdminAccess}
            disabled={verifying}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-white text-sm disabled:opacity-50"
          >
            <UserCheck className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            {verifying ? 'Verifying...' : 'Verify Access'}
          </button>
          <button 
            onClick={handleRefresh}
            disabled={refreshing || loading || verifying}
            className="flex items-center gap-2 px-3 py-2 bg-light-blue hover:bg-highlight-blue rounded-lg transition-colors text-white text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <StatusMessages error={error} debugInfo={debugInfo} />

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
        />
      </div>

      <div className="overflow-x-auto">
        <UserList
          users={filteredUsers}
          businesses={businesses}
          loading={loading}
          verifying={verifying}
          updatingRoles={updatingRoles}
          onUpdateRole={updateUserRole}
          onAssignBusiness={assignUserToBusiness}
        />
      </div>
    </div>
  );
}