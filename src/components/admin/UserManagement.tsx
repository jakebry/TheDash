import { useState, useEffect } from 'react';
import { Search, Building2 } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
    fetchBusinesses();
  }, []);

  async function fetchBusinesses() {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name');

      if (error) throw error;
      setBusinesses(data);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast.error('Failed to load businesses');
    }
  }

  async function fetchUsers() {
    try {
      setLoading(true);

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, role, full_name, created_at, email')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      const { data: rawMemberships, error: membershipError } = await supabase
        .from('business_members')
        .select('user_id, businesses(id, name)');

      if (membershipError) throw membershipError;

      const memberships = rawMemberships as {
        user_id: string;
        businesses: {
          id: string;
          name: string;
        }[];
      }[];

      const usersWithBusinesses = usersData.map(user => ({
        ...user,
        businesses: memberships
          .filter(m => m.user_id === user.id)
          .flatMap(m => m.businesses.map(b => ({
            id: b.id,
            name: b.name,
          }))),
      }));

      setUsers(usersWithBusinesses);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: 'admin' | 'business' | 'user') {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user =>
        user.id === userId ? { ...user, role: newRole } : user
      ));

      toast.success('User role updated successfully');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
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

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleColors = {
    admin: 'bg-purple-500',
    business: 'bg-emerald-500',
    user: 'bg-blue-500',
  };

  return (
    <div className="bg-highlight-blue rounded-xl p-6 mt-8">
      <h2 className="text-xl font-semibold text-white mb-6">User Management</h2>

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
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-48 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-24 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-32 animate-pulse" /></td>
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
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as 'admin' | 'business' | 'user')}
                        className="bg-light-blue text-white border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-neon-blue"
                      >
                        <option value="user">User</option>
                        <option value="business">Business</option>
                        <option value="admin">Admin</option>
                      </select>
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
      </div>
    </div>
  );
}
