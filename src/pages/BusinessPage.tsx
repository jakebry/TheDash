import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Settings, Calendar, MessageSquare, FileText, Edit, Briefcase } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import { BusinessInviteModal } from '../components/business/BusinessInviteModal';
import toast from 'react-hot-toast';

interface BusinessMember {
  id: string;
  user_id: string;
  role: 'admin' | 'business' | 'user';
  joined_at: string;
  profile: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface Business {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  phone_number: string | null;
  address: string | null;
  website: string | null;
  created_at: string;
  created_by: string;
  owner?: {
    id: string;
    full_name: string;
    email: string;
  };
  members?: BusinessMember[];
}

type Tab = 'overview' | 'members' | 'settings';

export default function BusinessPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isOwner, setIsOwner] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [projectsCount, setProjectsCount] = useState(0);

  useEffect(() => {
    fetchUserBusinesses();
  }, [user]);

  useEffect(() => {
    if (selectedBusiness) {
      fetchUnreadMessageCounts();
      fetchProjectsCount();
    }
  }, [selectedBusiness]);

  // Set up real-time listener for business changes
  useEffect(() => {
    if (!user) return;

    const businessChanges = supabase
      .channel('business-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'businesses',
      }, () => {
        fetchUserBusinesses();
      })
      .subscribe();

    // Listen for business_members changes
    const memberChanges = supabase
      .channel('member-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'business_members',
        filter: user.id ? `user_id=eq.${user.id}` : undefined
      }, () => {
        fetchUserBusinesses();
      })
      .subscribe();

    return () => {
      businessChanges.unsubscribe();
      memberChanges.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (selectedBusiness) {
      fetchBusinessMembers(selectedBusiness.id);
      checkOwnerStatus(selectedBusiness);
    }
  }, [selectedBusiness]);

  const fetchUserBusinesses = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { data: membershipData, error: membershipError } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id);
        
      if (membershipError) throw membershipError;
      
      if (!membershipData || membershipData.length === 0) {
        setBusinesses([]);
        setLoading(false);
        return;
      }
      
      const businessIds = membershipData.map(membership => membership.business_id);
      
      const { data: businessesData, error: businessesError } = await supabase
        .from('businesses')
        .select(`
          *,
          owner:profiles!businesses_created_by_fkey (
            id, full_name, email
          )
        `)
        .in('id', businessIds);
        
      if (businessesError) throw businessesError;
      
      setBusinesses(businessesData || []);
      
      // If we have businesses, select the first one by default
      if (businessesData && businessesData.length > 0) {
        setSelectedBusiness(businessesData[0]);
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessMembers = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('business_members')
        .select(`
          *,
          profile:profiles(id, full_name, email, avatar_url)
        `)
        .eq('business_id', businessId);
        
      if (error) throw error;
      
      setMembers(data as BusinessMember[] || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load team members');
    }
  };

  const fetchProjectsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', selectedBusiness?.id)
        .eq('status', 'active');

      if (error) throw error;
      
      setProjectsCount(count || 0);
    } catch (error) {
      console.error('Error fetching projects count:', error);
    }
  };

  const fetchUnreadMessageCounts = async () => {
    try {
      // Get unread count using the new RPC function
      const { data: unreadCount, error } = await supabase
        .rpc('get_business_unread_count', {
          p_business_id: selectedBusiness?.id,
          p_user_id: user?.id
        });

      if (error) throw error;

      // Set the unread count in state
      setUnreadCounts({ total: unreadCount || 0 });
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const checkOwnerStatus = (business: Business) => {
    // User is owner if they created the business
    setIsOwner(user?.id === business.created_by);
  };

  const handleBusinessChange = (businessId: string) => {
    const business = businesses.find(b => b.id === businessId);
    if (business) {
      setSelectedBusiness(business);
      // Reset to overview tab when changing business
      setActiveTab('overview');
    }
  };

  const BusinessSelector = () => {
    if (businesses.length <= 1) return null;
    
    return (
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Select Business
        </label>
        <select
          value={selectedBusiness?.id || ''}
          onChange={(e) => handleBusinessChange(e.target.value)}
          className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const BusinessOverview = () => {
    if (!selectedBusiness) return null;
    
    return (
      <div className="space-y-6">
        <div className="bg-highlight-blue rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {selectedBusiness.logo_url ? (
                <img 
                  src={selectedBusiness.logo_url} 
                  alt={selectedBusiness.name} 
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-neon-blue/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-neon-blue" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedBusiness.name}</h2>
                {selectedBusiness.description && (
                  <p className="text-gray-300 mt-1">{selectedBusiness.description}</p>
                )}
              </div>
            </div>
            
            {isOwner && (
              <button
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2 px-3 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Manage Business
              </button>
            )}
          </div>
        </div>

        {/* Business stats and quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            icon={<Users className="w-5 h-5 text-neon-blue" />}
            label="Team Members"
            value={members.length.toString()}
            onClick={() => setActiveTab('members')}
          />
          
          <StatCard 
            icon={<Briefcase className="w-5 h-5 text-emerald-500" />}
            label="Active Projects"
            value={projectsCount.toString()}
            onClick={() => navigate(`/projects/${selectedBusiness.id}`)}
          />
          
          <StatCard 
            icon={<MessageSquare className="w-5 h-5 text-yellow-500" />}
            label="Messages"
            value={(unreadCounts.total || 0).toString()}
            subtitle="unread"
            onClick={() => navigate('/chat')}
          />
        </div>

        {/* Contact Information */}
        <div className="bg-highlight-blue rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Phone Number</p>
              <p className="text-white">{selectedBusiness.phone_number || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Address</p>
              <p className="text-white">{selectedBusiness.address || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Website</p>
              {selectedBusiness.website ? (
                <a 
                  href={selectedBusiness.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-neon-blue hover:underline"
                >
                  {selectedBusiness.website.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <p className="text-white">Not provided</p>
              )}
            </div>
            <div>
              <p className="text-gray-400 text-sm">Business Owner</p>
              <p className="text-white">{selectedBusiness.owner?.full_name || 'Unknown'}</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-highlight-blue rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <ActivityItem 
              icon={<Users className="w-4 h-4 text-neon-blue" />}
              title="New team member joined"
              description="John Doe joined the team"
              time="2 hours ago"
            />
            <ActivityItem 
              icon={<Briefcase className="w-4 h-4 text-emerald-500" />}
              title="New project created"
              description="Highland Towers Construction project was created"
              time="1 day ago"
            />
            <ActivityItem 
              icon={<MessageSquare className="w-4 h-4 text-yellow-500" />}
              title="New message"
              description="You have 3 unread messages"
              time="2 days ago"
            />
          </div>
        </div>
      </div>
    );
  };

  const BusinessMembers = () => {
    if (!selectedBusiness) return null;
    
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Team Members</h2>
          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Users className="w-4 h-4" />
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
                  <th className="pb-3 text-gray-400 font-medium">Role</th>
                  <th className="pb-3 text-gray-400 font-medium">Joined</th>
                  {isOwner && <th className="pb-3 text-gray-400 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={isOwner ? 4 : 3} className="py-4 text-center text-gray-400">
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
                                alt={member.profile.full_name}
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
                          member.role === 'admin' ? 'bg-purple-500' : 
                          member.role === 'business' ? 'bg-emerald-500' : 
                          'bg-blue-500'
                        }`}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 text-gray-300">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </td>
                      {isOwner && member.user_id !== user?.id && (
                        <td className="py-4">
                          <button
                            className="text-red-400 hover:text-red-300 text-sm"
                            onClick={() => handleRemoveMember(member.id, member.profile.full_name || member.profile.email)}
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
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this business?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('business_members')
        .delete()
        .eq('id', memberId);
        
      if (error) throw error;
      
      // Refresh member list
      if (selectedBusiness) {
        fetchBusinessMembers(selectedBusiness.id);
      }
      
      toast.success(`${memberName} removed from business`);
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove team member');
    }
  };

  const StatCard = ({ icon, label, value, subtitle, onClick }: { 
    icon: React.ReactNode; 
    label: string; 
    value: string; 
    subtitle?: string;
    onClick?: () => void 
  }) => {
    return (
      <div 
        className={`bg-highlight-blue text-white rounded-xl p-4 flex items-center space-x-4 ${onClick ? 'cursor-pointer hover:bg-light-blue transition-colors' : ''}`}
        onClick={onClick}
      >
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="text-sm text-gray-300">{label}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold">{value}</span>
            {subtitle && <span className="text-sm text-gray-400">{subtitle}</span>}
          </div>
        </div>
      </div>
    );
  };

  const ActivityItem = ({ icon, title, description, time }: { icon: React.ReactNode; title: string; description: string; time: string }) => {
    return (
      <div className="flex items-start gap-3 border-b border-gray-700 pb-4">
        <div className="p-2 bg-light-blue rounded-lg">
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-medium text-white">{title}</div>
          <div className="text-sm text-gray-400">{description}</div>
        </div>
        <div className="text-xs text-gray-500">{time}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
        </div>
      </Layout>
    );
  }

  if (businesses.length === 0) {
    return (
      <Layout>
        <div className="bg-highlight-blue rounded-xl p-8 text-center max-w-lg mx-auto">
          <Building2 className="w-12 h-12 text-neon-blue mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Business Access</h2>
          <p className="text-gray-300 mb-6">You're not a member of any business yet. You need to be invited to a business to access this page.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <BusinessSelector />
      
      <div className="mb-6">
        <div className="border-b border-gray-700">
          <nav className="flex gap-4">
            <button
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'overview' 
                  ? 'text-white border-b-2 border-neon-blue' 
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'members' 
                  ? 'text-white border-b-2 border-neon-blue' 
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('members')}
            >
              Team Members
            </button>
            {isOwner && (
              <button
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'settings' 
                    ? 'text-white border-b-2 border-neon-blue' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                Business Settings
              </button>
            )}
          </nav>
        </div>
      </div>

      <div className="py-4">
        {activeTab === 'overview' && <BusinessOverview />}
        {activeTab === 'members' && <BusinessMembers />}
        {activeTab === 'settings' && isOwner && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Business Settings</h2>
            <BusinessSettings 
              business={selectedBusiness} 
              onUpdate={() => fetchUserBusinesses()} 
            />
          </div>
        )}
      </div>

      {showInviteModal && selectedBusiness && (
        <BusinessInviteModal 
          businessId={selectedBusiness.id}
          businessName={selectedBusiness.name}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </Layout>
  );
}

interface BusinessSettingsProps {
  business: Business | null;
  onUpdate: () => void;
}

function BusinessSettings({ business, onUpdate }: BusinessSettingsProps) {
  const [name, setName] = useState(business?.name || '');
  const [description, setDescription] = useState(business?.description || '');
  const [phone, setPhone] = useState(business?.phone_number || '');
  const [address, setAddress] = useState(business?.address || '');
  const [website, setWebsite] = useState(business?.website || '');
  const [logoUrl, setLogoUrl] = useState(business?.logo_url || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setName(business.name || '');
      setDescription(business.description || '');
      setPhone(business.phone_number || '');
      setAddress(business.address || '');
      setWebsite(business.website || '');
      setLogoUrl(business.logo_url || '');
    }
  }, [business]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('businesses')
        .update({
          name,
          description,
          phone_number: phone,
          address,
          website,
          logo_url: logoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', business.id);
        
      if (error) throw error;
      
      toast.success('Business information updated');
      onUpdate();
    } catch (error) {
      console.error('Error updating business:', error);
      toast.error('Failed to update business information');
    } finally {
      setSaving(false);
    }
  };

  if (!business) return null;

  return (
    <div className="bg-highlight-blue rounded-xl p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Business Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Logo URL
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Business Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              placeholder="https://"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Business Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}