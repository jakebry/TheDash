import { useState, useEffect } from 'react';
import { Building2, RefreshCw, Trash2, AlertCircle, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { DeleteBusinessModal } from './DeleteBusinessModal';
import { BusinessInviteModal } from '../business/BusinessInviteModal';

interface Business {
  id: string;
  name: string;
  created_by: string;
  description: string | null;
  phone_number: string | null;
  address: string | null;
  website: string | null;
  created_at: string;
}

interface Owner {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface BusinessWithOwner extends Business {
  owner: Owner | null;
}

export function BusinessManagement() {
  const [businesses, setBusinesses] = useState<BusinessWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<BusinessWithOwner | null>(null);
  const [businessToInvite, setBusinessToInvite] = useState<BusinessWithOwner | null>(null);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      
      // Fetch businesses with their owners
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select(`
          *,
          owner:profiles!businesses_created_by_fkey (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (businessError) throw businessError;
      
      // For each business, get the member count
      const businessesWithMembers = await Promise.all((businessData as BusinessWithOwner[] || []).map(async (business) => {
        const { count, error: countError } = await supabase
          .from('business_members')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', business.id);
          
        if (countError) console.error('Error getting member count:', countError);
        
        return {
          ...business,
          memberCount: count || 0
        };
      }));
      
      setBusinesses(businessesWithMembers || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBusinesses();
  };

  const handleDeleteBusiness = (business: BusinessWithOwner) => {
    setBusinessToDelete(business);
  };

  const handleInviteToBusinessClick = (business: BusinessWithOwner) => {
    setBusinessToInvite(business);
  };

  const onBusinessDeleted = () => {
    setBusinessToDelete(null);
    fetchBusinesses();
  };

  const BusinessRiskIndicator = ({ memberCount = 0 }: { memberCount?: number }) => {
    if (memberCount === 0) return null;

    const riskClass = memberCount > 10 
      ? 'bg-red-500/20 border-red-500/30 text-red-400' 
      : memberCount > 5 
        ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' 
        : 'bg-green-500/20 border-green-500/30 text-green-400';
        
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${riskClass}`}>
        <AlertCircle className="w-3.5 h-3.5" />
        <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
      </div>
    );
  };

  return (
    <div className="bg-highlight-blue rounded-xl p-6 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Business Management</h2>
        <button 
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3 py-2 bg-light-blue hover:bg-highlight-blue rounded-lg transition-colors text-white text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="pb-3 text-gray-400 font-medium">Business</th>
              <th className="pb-3 text-gray-400 font-medium">Owner</th>
              <th className="pb-3 text-gray-400 font-medium">Contact</th>
              <th className="pb-3 text-gray-400 font-medium">Members</th>
              <th className="pb-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-48 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-40 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-32 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-24 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-24 animate-pulse" /></td>
                </tr>
              ))
            ) : businesses.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">
                  No businesses found
                </td>
              </tr>
            ) : (
              businesses.map((business) => (
                <tr key={business.id}>
                  <td className="py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-neon-blue" />
                        <span className="font-medium text-white">{business.name}</span>
                      </div>
                      {business.description && (
                        <p className="text-sm text-gray-400 mt-1">{business.description}</p>
                      )}
                      {business.website && (
                        <a 
                          href={business.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-neon-blue hover:underline mt-1 block"
                        >
                          {business.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-4">
                    <div>
                      <div className="font-medium text-white">
                        {business.owner?.full_name || 'Unnamed User'}
                      </div>
                      <div className="text-sm text-gray-400">
                        {business.owner?.email}
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    {business.phone_number && (
                      <div className="text-white">{business.phone_number}</div>
                    )}
                    {business.address && (
                      <div className="text-sm text-gray-400 mt-1">{business.address}</div>
                    )}
                  </td>
                  <td className="py-4">
                    <BusinessRiskIndicator memberCount={business.memberCount} />
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleInviteToBusinessClick(business)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue rounded-lg text-xs"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Invite
                      </button>
                      <button
                        onClick={() => handleDeleteBusiness(business)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {businessToDelete && (
        <DeleteBusinessModal
          businessId={businessToDelete.id}
          businessName={businessToDelete.name}
          onClose={() => setBusinessToDelete(null)}
          onDeleted={onBusinessDeleted}
        />
      )}

      {businessToInvite && (
        <BusinessInviteModal
          businessId={businessToInvite.id}
          businessName={businessToInvite.name}
          onClose={() => setBusinessToInvite(null)}
        />
      )}
    </div>
  );
}