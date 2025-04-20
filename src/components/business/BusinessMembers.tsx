import { User } from 'lucide-react';
import { BusinessMember, BusinessRole } from '../../types/business';

interface BusinessMembersProps {
  members: BusinessMember[];
  isOwner: boolean;
  onInviteClick: () => void;
  onRemoveMember: (memberId: string, memberName: string) => void;
  currentUserId?: string;
}

export function BusinessMembers({ 
  members, 
  isOwner, 
  onInviteClick,
  onRemoveMember,
  currentUserId
}: BusinessMembersProps) {
  const roleColors = {
    admin: 'bg-purple-500',
    business: 'bg-emerald-500',
    user: 'bg-blue-500'
  };

  const businessRoleColors = {
    owner: 'bg-amber-500',
    supervisor: 'bg-green-500',
    lead: 'bg-cyan-500',
    employee: 'bg-blue-400'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Team Members</h2>
        {isOwner && (
          <button
            onClick={onInviteClick}
            className="flex items-center gap-2 px-3 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <User className="w-4 h-4" />
            Invite Members
          </button>
        )}
      </div>

      <div className="bg-highlight-blue rounded-xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-700">
                <th className="pb-3 text-gray-400 font-medium">Member</th>
                <th className="pb-3 text-gray-400 font-medium">App Role</th>
                <th className="pb-3 text-gray-400 font-medium">Business Role</th>
                <th className="pb-3 text-gray-400 font-medium">Joined</th>
                {isOwner && <th className="pb-3 text-gray-400 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 5 : 4} className="py-4 text-center text-gray-400">
                    No team members found
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id}>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neon-blue/20 flex items-center justify-center overflow-hidden">
                          {member.profile.avatar_url ? (
                            <img
                              src={member.profile.avatar_url}
                              alt={member.profile.full_name || member.profile.email}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm text-white">
                              {member.profile.full_name?.[0] || member.profile.email[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">{member.profile.full_name || 'Unnamed User'}</div>
                          <div className="text-sm text-gray-400">{member.profile.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium text-white ${
                        roleColors[member.role as keyof typeof roleColors] || 'bg-gray-500'
                      }`}>
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    </td>

                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium text-white ${
                        businessRoleColors[member.is_creator ? 'owner' : (member.business_role as BusinessRole) || 'employee'] || 'bg-gray-500'
                      }`}>
                        {member.is_creator ? 'Owner' : (member.business_role?.charAt(0).toUpperCase() + member.business_role?.slice(1)) || 'Employee'}
                      </span>
                    </td>

                    <td className="py-4 text-gray-300">
                      {new Date(member.joined_at).toLocaleDateString()}
                    </td>

                    {isOwner && member.user_id !== currentUserId && (
                      <td className="py-4">
                        <button
                          className="text-red-400 hover:text-red-300 text-sm"
                          onClick={() => onRemoveMember(member.id, member.profile.full_name || member.profile.email)}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}