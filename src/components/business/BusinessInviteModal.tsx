import { useState, useEffect } from 'react';
import { X, Search, User, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/useAuth';

interface BusinessInviteModalProps {
  businessId: string;
  businessName: string;
  onClose: () => void;
}

interface UserSearchResult {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  isMember: boolean;
}

export function BusinessInviteModal({ businessId, businessName, onClose }: BusinessInviteModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  useEffect(() => {
    // Debounce search
    const timeoutId = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchUsers(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const searchUsers = async (query: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // First get existing business members to filter them out
      const { data: membersData, error: membersError } = await supabase
        .from('business_members')
        .select('user_id')
        .eq('business_id', businessId);
        
      if (membersError) throw membersError;
      
      const existingMemberIds = membersData?.map(member => member.user_id) || [];
      
      // Search for users by email or name - use ilike with separate filters for better results
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .or(`email.ilike.%${query}%,email.eq.${query},full_name.ilike.%${query}%`)
        .neq('id', user.id) // Exclude the current user
        .limit(10);
        
      if (error) throw error;
      
      // Mark which users are already members
      const formattedResults = (data || []).map((user) => ({
        ...user,
        isMember: existingMemberIds.includes(user.id)
      }));
      
      setSearchResults(formattedResults);

      if (formattedResults.length === 0 && query.includes('@')) {
        // Try a more exact search for emails
        const { data: exactData, error: exactError } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url')
          .eq('email', query.trim())
          .limit(1);
          
        if (!exactError && exactData && exactData.length > 0) {
          const exactResults = exactData.map(user => ({
            ...user,
            isMember: existingMemberIds.includes(user.id)
          }));
          setSearchResults(exactResults);
        }
      }
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const inviteUser = async (userId: string, userName: string) => {
    try {
      setInviting(prev => ({ ...prev, [userId]: true }));
      
      // First check if the user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('business_members')
        .select('id')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      if (existingMember) {
        toast.error(`${userName} is already a member of this business`);
        return;
      }

      // Create a notification for the user
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: 'Business Invitation',
          message: `You've been invited to join ${businessName}`,
          type: 'business_invitation',
          metadata: {
            business_id: businessId,
            business_name: businessName,
            inviter_id: user?.id,
            inviter_name: user?.user_metadata?.full_name || user?.email
          }
        });
        
      if (notificationError) throw notificationError;
      
      // Update the UI to show the user as invited
      setSearchResults(prev => 
        prev.map(result => 
          result.id === userId 
            ? { ...result, isMember: true } 
            : result
        )
      );
      
      toast.success(`Invitation sent to ${userName}`);
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error('Failed to send invitation');
    } finally {
      setInviting(prev => ({ ...prev, [userId]: false }));
    }
  };
  
  // Determine which message to show based on state
  const renderResultsContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
        </div>
      );
    }
    
    if (searchResults.length === 0) {
      if (searchTerm.length >= 2) {
        return (
          <div className="text-center py-8 text-gray-400">
            No users found matching "{searchTerm}"
          </div>
        );
      }
      return (
        <div className="text-center py-8 text-gray-400">
          Search for users by name or email
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {searchResults.map((result) => (
          <div 
            key={result.id}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-light-blue transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neon-blue/20 flex items-center justify-center overflow-hidden">
                {result.avatar_url ? (
                  <img
                    src={result.avatar_url}
                    alt={result.full_name || result.email}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <div className="font-medium text-white">{result.full_name || 'Unnamed User'}</div>
                <div className="text-sm text-gray-400">{result.email}</div>
              </div>
            </div>
            
            {result.isMember ? (
              <span className="flex items-center gap-1 text-sm text-emerald-400">
                <Check className="w-4 h-4" />
                Member
              </span>
            ) : (
              <button
                onClick={() => inviteUser(result.id, result.full_name || result.email)}
                disabled={inviting[result.id]}
                className="text-sm px-3 py-1 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {inviting[result.id] ? 'Inviting...' : 'Invite'}
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-highlight-blue p-6 rounded-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Invite Team Members</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
          />
        </div>

        {/* Fixed height container to prevent layout shifts */}
        <div 
          className="h-72 overflow-y-auto mb-4 relative" 
          onWheel={(e) => e.currentTarget.scrollBy(0, e.deltaY)}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {renderResultsContent()}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}