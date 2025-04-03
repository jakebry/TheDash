import { useState, useEffect } from 'react';
import { X, Search, Users, Check, Building2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import toast from 'react-hot-toast';

interface Business {
  id: string;
  name: string;
}

interface BusinessMember {
  id: string;
  user_id: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'group' | 'private';
  business_id: string;
  business_name: string;
  recipient_id?: string;
  recipient?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface CreateChatModalProps {
  businesses: Business[];
  onClose: () => void;
  onChatCreated: (chat: ChatRoom) => void;
}

export function CreateChatModal({ businesses, onClose, onChatCreated }: CreateChatModalProps) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [searchResults, setSearchResults] = useState<BusinessMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<BusinessMember | null>(null);
  const [selectedType, setSelectedType] = useState<'group' | 'private'>('private');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (businesses.length === 1) {
      setSelectedBusiness(businesses[0]);
    }
  }, [businesses]);

  useEffect(() => {
    if (selectedBusiness) {
      fetchBusinessMembers(selectedBusiness.id);
      setSearchTerm('');
      setSearchResults([]);
    } else {
      setMembers([]);
      setSearchResults([]);
    }
  }, [selectedBusiness]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchMembers(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const fetchBusinessMembers = async (businessId: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('business_members')
        .select(`
          id, user_id,
          profile:profiles(id, full_name, email, avatar_url)
        `)
        .eq('business_id', businessId)
        .neq('user_id', user?.id); // Exclude current user
        
      if (error) throw error;
      
      setMembers(data as BusinessMember[] || []);
    } catch (error) {
      console.error('Error fetching business members:', error);
      toast.error('Failed to load business members');
    } finally {
      setLoading(false);
    }
  };

  const searchMembers = async (query: string) => {
    try {
      const likeQuery = `%${query}%`;
      
      // Search by email and name simultaneously
      const [{ data: emailMatches }, { data: nameMatches }] = await Promise.all([
        supabase
          .from('business_members')
          .select(`
            id, user_id,
            profile:profiles(id, full_name, email, avatar_url)
          `)
          .eq('business_id', selectedBusiness?.id)
          .neq('user_id', user?.id)
          .textSearch('profile.email', likeQuery),
        supabase
          .from('business_members')
          .select(`
            id, user_id,
            profile:profiles(id, full_name, email, avatar_url)
          `)
          .eq('business_id', selectedBusiness?.id)
          .neq('user_id', user?.id)
          .textSearch('profile.full_name', likeQuery)
      ]);

      // Combine and deduplicate results
      const combined = [...(emailMatches || []), ...(nameMatches || [])];
      const uniqueResults = Array.from(
        new Map(combined.map(member => [member.id, member])).values()
      );

      setSearchResults(uniqueResults);
    } catch (error) {
      console.error('Error searching members:', error);
      toast.error('Failed to search members');
    }
  };

  const handleCreateChat = async () => {
    if (!user || !selectedBusiness) return;
    
    try {
      setCreating(true);
      
      if (selectedType === 'private') {
        if (!selectedMember) {
          toast.error('Please select a member to chat with');
          return;
        }
        
        // Check if private chat already exists
        const { data: existingChats, error: checkError } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('business_id', selectedBusiness.id)
          .eq('is_private', true)
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .or(`sender_id.eq.${selectedMember.profile.id},recipient_id.eq.${selectedMember.profile.id}`)
          .limit(1);
          
        if (checkError) throw checkError;
        
        // Create an initial message to establish the chat
        if (!existingChats || existingChats.length === 0) {
          const { error: messageError } = await supabase
            .rpc('send_system_message', {
              p_business_id: selectedBusiness.id,
              p_message: `Private chat started with ${selectedMember.profile.full_name || selectedMember.profile.email}`,
              p_is_private: true,
              p_recipient_id: selectedMember.profile.id
            });
            
          if (messageError) throw messageError;
        }
        
        // Return the chat info to parent component
        onChatCreated({
          id: `private-${selectedBusiness.id}-${selectedMember.profile.id}`,
          name: selectedMember.profile.full_name || selectedMember.profile.email,
          type: 'private',
          business_id: selectedBusiness.id,
          business_name: selectedBusiness.name,
          recipient_id: selectedMember.profile.id,
          recipient: selectedMember.profile
        });
      } else {
        // Return the group chat info
        onChatCreated({
          id: `group-${selectedBusiness.id}`,
          name: `${selectedBusiness.name} Group Chat`,
          type: 'group',
          business_id: selectedBusiness.id,
          business_name: selectedBusiness.name
        });
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Failed to create chat');
    } finally {
      setCreating(false);
    }
  };

  const displayMembers = searchTerm.length >= 2 ? searchResults : members;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-highlight-blue p-6 rounded-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">New Conversation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {businesses.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Business
              </label>
              <select
                value={selectedBusiness?.id || ''}
                onChange={(e) => {
                  const business = businesses.find(b => b.id === e.target.value);
                  setSelectedBusiness(business || null);
                  setSelectedMember(null);
                }}
                className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              >
                <option value="">Select a business</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {selectedBusiness && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Chat Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setSelectedType('private');
                      setSelectedMember(null);
                    }}
                    className={`p-3 rounded-lg border flex flex-col items-center transition-colors ${
                      selectedType === 'private'
                        ? 'bg-neon-blue/20 border-neon-blue'
                        : 'bg-light-blue border-gray-600 hover:bg-light-blue/80'
                    }`}
                  >
                    <User className={`w-6 h-6 mb-2 ${selectedType === 'private' ? 'text-neon-blue' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium text-white">Private Chat</span>
                  </button>
                  
                  <button
                    onClick={() => setSelectedType('group')}
                    className={`p-3 rounded-lg border flex flex-col items-center transition-colors ${
                      selectedType === 'group'
                        ? 'bg-neon-blue/20 border-neon-blue'
                        : 'bg-light-blue border-gray-600 hover:bg-light-blue/80'
                    }`}
                  >
                    <Users className={`w-6 h-6 mb-2 ${selectedType === 'group' ? 'text-neon-blue' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium text-white">Group Chat</span>
                  </button>
                </div>
              </div>
              
              {selectedType === 'group' ? (
                <div className="p-4 rounded-lg bg-light-blue/50 border border-gray-600 text-center">
                  <Building2 className="w-8 h-8 text-neon-blue mx-auto mb-2" />
                  <h3 className="font-medium text-white mb-1">{selectedBusiness.name} Group Chat</h3>
                  <p className="text-sm text-gray-400">
                    This chat is visible to all members of the business
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Team Member
                  </label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  
                  <div className="h-60 overflow-y-auto rounded-lg border border-gray-600">
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-700 relative">
                        {displayMembers.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">
                            {searchTerm.length >= 2 
                              ? `No members found matching "${searchTerm}"`
                              : searchTerm.length === 1
                              ? 'Type at least 2 characters to search'
                              : 'No team members found'}
                          </div>
                        ) : (
                          displayMembers.map((member) => (
                          <button
                            key={member.id}
                            onClick={() => setSelectedMember(selectedMember?.id === member.id ? null : member)}
                            className={`w-full p-3 flex items-center hover:bg-light-blue/50 transition-colors ${
                              selectedMember?.id === member.id ? 'bg-neon-blue/20' : ''
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-neon-blue/20 flex items-center justify-center overflow-hidden mr-3">
                              {member.profile?.avatar_url ? (
                                <img
                                  src={member.profile.avatar_url}
                                  alt={member.profile.full_name || member.profile.email}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-neon-blue" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-white">
                                {member.profile?.full_name || 'Unnamed User'}
                              </div>
                              <div className="text-sm text-gray-400">{member.profile?.email || 'No email'}</div>
                            </div>
                            {selectedMember?.id === member.id && (
                              <Check className="w-5 h-5 text-neon-blue" />
                            )}
                          </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-600 text-white rounded-lg hover:bg-light-blue transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateChat}
                  disabled={creating || (selectedType === 'private' && !selectedMember)}
                  className="px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Start Chat'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}