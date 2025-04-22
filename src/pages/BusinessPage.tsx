import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import { BusinessInviteModal } from '../components/business/BusinessInviteModal';
import toast from 'react-hot-toast';
import { Business, BusinessMember, BusinessRole } from '../types/business';
import { BusinessSelector } from '../components/business/BusinessSelector';
import { BusinessOverview } from '../components/business/BusinessOverview';
import { BusinessSettings } from '../components/business/BusinessSettings';
import { BusinessMembers } from '../components/business/BusinessMembers';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'overview' | 'members' | 'settings';

const tabVariants = {
  initial: { opacity: 0, x: 20 },
  enter: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

const tabTransition = {
  duration: 0.2,
  ease: 'easeInOut'
};

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
      fetchBusinessMembers(selectedBusiness.id);
      checkOwnerStatus(selectedBusiness);
      fetchUnreadMessageCounts();
      fetchProjectsCount();
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
      // Fetch all business members with their profiles
      const { data: membersData, error: membersError } = await supabase
        .from('business_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          profile:profiles(id, full_name, email, avatar_url)
        `)
        .eq('business_id', businessId); // Removed any role-based restrictions

      if (membersError) throw membersError;

      // Fetch business roles from the business_user_roles table
      const { data: businessRolesData, error: businessRolesError } = await supabase
        .from('business_user_roles')
        .select('user_id, role')
        .eq('business_id', businessId);

      if (businessRolesError) throw businessRolesError;

      // Create a map of user_id to business role for quick lookup
      const businessRoleMap = new Map<string, string>();
      if (businessRolesData) {
        businessRolesData.forEach(role => {
          businessRoleMap.set(role.user_id, role.role);
        });
      }

      // Get the business creator's ID
      const { data: businessData } = await supabase
        .from('businesses')
        .select('created_by')
        .eq('id', businessId)
        .single();

      // Merge the business role data with the members data
      const membersWithRoles = Array.isArray(membersData) ? membersData.map(member => {
        const businessRole = businessRoleMap.get(member.user_id) || 'employee';
        const isCreator = businessData?.created_by === member.user_id;

        return {
          ...member,
          profile: Array.isArray(member.profile) ? member.profile[0] : member.profile, // Ensure profile is a single object
          business_role: businessRole as BusinessRole, // Ensure proper typing
          is_creator: isCreator
        };
      }) : [];

      setMembers(membersWithRoles);
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
      // Get unread count using the RPC function
      const { data: unreadCount, error } = await supabase
        .rpc('get_business_unread_count', {
          p_business_id: selectedBusiness?.id,
          p_user_id: user?.id
        });

      if (error) throw error;

      setUnreadCounts({ total: unreadCount || 0 });
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const checkOwnerStatus = async (business: Business) => {
    setIsOwner(user?.id === business.created_by);
  };

  const handleBusinessChange = (businessId: string) => {
    const business = businesses.find(b => b.id === businessId);
    if (business) {
      setSelectedBusiness(business);
      setActiveTab('overview');
    }
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
          <div className="w-12 h-12 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-neon-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/><path d="M1 21h22"/><path d="M12 7v14"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          </div>
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
      <BusinessSelector 
        businesses={businesses} 
        selectedBusiness={selectedBusiness} 
        onBusinessChange={handleBusinessChange} 
      />
      
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
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && selectedBusiness && (
            <motion.div
              key="overview"
              initial="initial"
              animate="enter"
              exit="exit"
              variants={tabVariants}
              transition={tabTransition}
            >
              <BusinessOverview
                business={selectedBusiness}
                members={members}
                isOwner={isOwner}
                projectsCount={projectsCount}
                unreadCounts={unreadCounts}
                onEditClick={() => setActiveTab('settings')}
              />
            </motion.div>
          )}
          
          {activeTab === 'members' && (
            <motion.div
              key="members"
              initial="initial"
              animate="enter"
              exit="exit"
              variants={tabVariants}
              transition={tabTransition}
            >
              <BusinessMembers
                members={members}
                isOwner={isOwner}
                onInviteClick={() => setShowInviteModal(true)}
                onRemoveMember={handleRemoveMember}
                currentUserId={user?.id}
              />
            </motion.div>
          )}
          
          {activeTab === 'settings' && isOwner && (
            <motion.div
              key="settings"
              initial="initial"
              animate="enter"
              exit="exit"
              variants={tabVariants}
              transition={tabTransition}
            >
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Business Settings</h2>
                <BusinessSettings 
                  business={selectedBusiness} 
                  onUpdate={() => fetchUserBusinesses()} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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