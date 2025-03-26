import { Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { Business, User } from '../../types/admin';
import { LoadingRows } from './LoadingRows';
import { RoleSelect } from './RoleSelect';

interface UserListProps {
  users: User[];
  businesses: Business[];
  loading: boolean;
  verifying: boolean;
  updatingRoles: Record<string, boolean>;
  onUpdateRole: (userId: string, newRole: 'admin' | 'business' | 'user') => void;
  onAssignBusiness: (userId: string, businessId: string) => void;
}

const roleColors = {
  admin: 'bg-purple-500',
  business: 'bg-emerald-500',
  user: 'bg-blue-500',
};

export function UserList({
  users,
  businesses,
  loading,
  verifying,
  updatingRoles,
  onUpdateRole,
  onAssignBusiness,
}: UserListProps) {
  const { user: currentUser } = useAuth();

  if (loading || verifying) {
    return <LoadingRows />;
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No users found. Try clicking "Verify Access" to fix admin permissions.
      </div>
    );
  }

  return (
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
        {users.map(user => (
          <tr key={user.id}>
            <td className="py-4">
              <div>
                <div className="font-medium text-white">{user.full_name || 'Unnamed User'}</div>
                <div className="text-sm text-gray-400">{user.email}</div>
              </div>
            </td>
            <td className="py-4">
              {user.id !== currentUser?.id ? (
                <RoleSelect
                  value={user.role}
                  onChange={(role) => onUpdateRole(user.id, role)}
                  disabled={updatingRoles[user.id]}
                  isUpdating={updatingRoles[user.id]}
                />
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
                      onAssignBusiness(user.id, e.target.value);
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
        ))}
      </tbody>
    </table>
  );
}