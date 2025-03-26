import { useState } from 'react';
import { Search, RefreshCw, UserCheck } from 'lucide-react';
import { useUserManagement } from '../../hooks/useUserManagement';
import { UserList } from './UserList';
import { StatusMessages } from './StatusMessages';

export function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const {
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
  } = useUserManagement();

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