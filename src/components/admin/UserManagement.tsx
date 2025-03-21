import { useState, useEffect } from 'react';
import { Check, X, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/useAuth';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'business' | 'user';
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user emails from auth.users
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      
      const usersWithEmail = data.map(profile => ({
        ...profile,
        email: authUsers.users.find(u => u.id === profile.id)?.email || 'N/A'
      }));

      setUsers(usersWithEmail);
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

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleColors = {
    admin: 'bg-purple-500',
    business: 'bg-emerald-500',
    user: 'bg-blue-500'
  };

  return (
    <div className="bg-highlight-blue rounded-xl p-6 mt-8">
      <h2 className="text-xl font-semibold text-white mb-6">User Management</h2>
      
      <div className="relative mb-6">
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
              <th className="pb-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="py-4">
                    <div className="h-6 bg-light-blue/50 rounded w-48 animate-pulse" />
                  </td>
                  <td className="py-4">
                    <div className="h-6 bg-light-blue/50 rounded w-24 animate-pulse" />
                  </td>
                  <td className="py-4">
                    <div className="h-6 bg-light-blue/50 rounded w-32 animate-pulse" />
                  </td>
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
                    <span className={`px-2 py-1 rounded-md text-xs font-medium text-white ${roleColors[user.role]}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="py-4">
                    {user.id !== currentUser?.id ? (
                      <div className="flex gap-2">
                        {['admin', 'business', 'user'].map(role => (
                          <button
                            key={role}
                            onClick={() => updateUserRole(user.id, role as 'admin' | 'business' | 'user')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              user.role === role
                                ? 'bg-neon-blue text-white'
                                : 'bg-light-blue text-gray-300 hover:bg-highlight-blue'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Cannot modify own role</span>
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