import { useState, useEffect } from 'react';
import { Search, Building2, RefreshCw, AlertTriangle, User, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/useAuth';

interface Business {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'business' | 'user';
  created_at: string;
  businesses?: Business[];
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [updatingRoles, setUpdatingRoles] = useState<Record<string, boolean>>({});
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
    fetchBusinesses();
    
    // Set up real-time subscription for profile changes
    const profilesSubscription = supabase
      .channel('profiles-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'profiles' 
        }, 
        () => {
          // When any profile changes, refresh the user list
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

      // Try multiple methods to fetch users, starting with the most reliable
      let success = false;
      
      // Method 1: Try admin_list_all_profiles RPC function
      try {
        const { data: adminListData, error: adminListError } = await supabase
          .rpc('admin_list_all_profiles');
          
        if (!adminListError && adminListData && adminListData.length > 0) {
          // Format business data
          const usersWithBusinesses = await addBusinessesToUsers(adminListData);
          setUsers(usersWithBusinesses);
          success = true;
          console.log(`Successfully loaded ${usersWithBusinesses.length} users via admin_list_all_profiles`);
          return;
        }
      } catch (adminListErr) {
        console.warn('admin_list_all_profiles failed:', adminListErr);
      }
      
      // Method 2: Try list_users_with_businesses RPC function
      if (!success) {
        try {
          const { data: usersData, error: usersError } = await supabase
            .rpc('list_users_with_businesses');

          if (!usersError && usersData) {
            // Convert and format the RPC result to match our User interface
            const formattedUsers = usersData.map(user => ({
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
      
      // Method 3: Direct query to profiles table as fallback
      if (!success) {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, role, full_name, email, created_at')
            .order('created_at', { ascending: false });
            
          if (!profilesError && profilesData) {
            // Format the data
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
      
      // If we've reached here, all methods failed
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
      // Get all business members
      const { data: memberships, error: membershipError } = await supabase
        .from('business_members')
        .select('user_id, business_id');
        
      if (membershipError) throw membershipError;
      
      // Get all businesses
      const { data: allBusinesses, error: businessError } = await supabase
        .from('businesses')
        .select('id, name');
        
      if (businessError) throw businessError;
      
      // Map businesses to users
      return users.map(user => {
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
      // Return users without businesses rather than failing completely
      return users.map(user => ({
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
      setUpdatingRoles({...updatingRoles, [userId]: true});
      
      // 1. Get the user's previous role for notification purposes
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('role, email, full_name')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      
      const previousRole = userData?.role || 'user';
      
      // 2. Update using specialized role update function
      const { data: updateResult, error: updateError } = await supabase
        .rpc('update_user_role_with_validation', {
          target_user_id: userId,
          new_role: newRole
        });
      
      if (updateError) {
        throw updateError;
      }
      
      if (!updateResult?.success) {
        throw new Error(updateResult?.error || 'Role update failed');
      }

      // Force a session refresh
      await supabase.auth.refreshSession();
      await supabase.rpc('force_jwt_refresh');
      
      // 3. Update local state
      setUsers(users.map(user =>
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      // 4. Create a notification for the admin (client-side)
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
      
      // The user being updated will receive their notification from the database trigger

      toast.success('User role updated successfully');
      
      // Only show refresh message for business role
      if (newRole === 'business') {
        toast.success('Business role activated! Click the notification to create your first business.');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    } finally {
      setUpdatingRoles({...updatingRoles, [userId]: false});
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
      
      // Try a series of fixes, each more aggressive than the last
      
      // 1. First fix profiles
      await supabase.rpc('ensure_profile_exists', { check_all: true });
      setDebugInfo('Step 1: Ensured all profiles exist');
      
      // 2. Fix admin visibility
      const { data: repairData } = await supabase.rpc('repair_admin_visibility');
      setDebugInfo(`Step 2: ${repairData || 'Repaired admin visibility'}`);
      
      // 3. Fix admin role in app_metadata
      const { data: fixAppData } = await supabase.rpc('fix_admin_app_metadata');
      setDebugInfo(`Step 3: ${fixAppData || 'Updated app metadata'}`);
      
      // 4. Force JWT refresh for admin permissions
      const { data: jwtData } = await supabase.rpc('force_jwt_refresh');
      setDebugInfo(`Step 4: ${jwtData || 'Forced JWT refresh'}`);
      
      // 5. Try to repair specific profile access issues
      const { data: profileFixData } = await supabase.rpc('fix_admin_profile_access');
      setDebugInfo(`Step 5: ${profileFixData || 'Fixed admin profile access'}`);
      
      // 6. Get final diagnostic status
      const { data: diagData } = await supabase.rpc('get_admin_diagnostic_info');
      
      // Attempt to fetch users now that we've fixed permissions
      await fetchUsers();
      
      // Show diagnostic status
      const isAdminInJwt = diagData?.roles?.is_admin_in_jwt === true;
      const isAdminInProfile = diagData?.roles?.is_admin_in_profile === true;
      
      setDebugInfo(`Admin access verification complete. JWT admin: ${isAdminInJwt || false}, 
        Profile admin: ${isAdminInProfile || false}.
        You may need to log out and log back in for all changes to take effect.`);
      
      toast.success('Admin access verification completed');
      
      // If we still don't have proper access, suggest a logout
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

  const roleColors = {
    admin: 'bg-purple-500',
    business: 'bg-emerald-500',
    user: 'bg-blue-500',
  };

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

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-white">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">User Visibility Issue</p>
              <p className="text-sm text-gray-300 mt-1">{error}</p>
              <p className="text-sm text-gray-300 mt-2">Try clicking the "Verify Access" button to fix permission issues.</p>
            </div>
          </div>
        </div>
      )}
      
      {debugInfo && (
        <div className="mb-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg text-white">
          <div className="flex items-start gap-2">
            <User className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Debug Information</p>
              <p className="text-sm text-gray-300 mt-1">{debugInfo}</p>
            </div>
          </div>
        </div>
      )}

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
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="pb-3 text-gray-400 font-medium">User</th>
              <th className="pb-3 text-gray-400 font-medium">Role</th>
              <th className="pb-3 text-gray-400 font-medium">Companies</th>
              <th className="pb-3 text-gray-400 font-medium">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading || verifying ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-48 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-24 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-32 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-40 animate-pulse" /></td>
                </tr>
              ))
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td className="py-4">
                    <div>
                      <div className="font-medium text-white">{user.full_name || 'Unnamed User'}</div>
                      <div className="text-sm text-gray-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="py-4">
                    {user.id !== currentUser?.id ? (
                      <div className="relative">
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value as 'admin' | 'business' | 'user')}
                          disabled={updatingRoles[user.id]}
                          className="bg-light-blue text-white border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-neon-blue disabled:opacity-50"
                        >
                          <option value="user">User</option>
                          <option value="business">Business</option>
                          <option value="admin">Admin</option>
                        </select>
                        {updatingRoles[user.id] && (
                          <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2">
                            <div className="w-3 h-3 border-t-2 border-r-2 border-neon-blue rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={`px-2 py-1 rounded-md text-xs font-medium text-white ${roleColors[user.role]}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      {user.businesses?.map((business) => (
                        <span
                          key={business.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-light-blue rounded-md text-xs text-white"
                        >
                          <Building2 className="w-3 h-3" />
                          {business.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4">
                    {user.id !== currentUser?.id ? (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            assignUserToBusiness(user.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="bg-light-blue text-white border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-neon-blue"
                      >
                        <option value="">Assign to company...</option>
                        {businesses.map((business) => (
                          <option key={business.id} value={business.id}>
                            {business.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-400">Cannot modify own account</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {filteredUsers.length === 0 && !loading && !verifying && (
          <div className="text-center py-8 text-gray-400">
            No users found. {searchTerm ? 'Try a different search term.' : 'Try clicking "Verify Access" to fix admin permissions.'}
          </div>
        )}
      </div>
    </div>
  );
}