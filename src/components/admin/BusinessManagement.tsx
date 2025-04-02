import { useState, useEffect } from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

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
      
      setBusinesses(businessData as BusinessWithOwner[] || []);
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
              <th className="pb-3 text-gray-400 font-medium">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-48 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-40 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-32 animate-pulse" /></td>
                  <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-40 animate-pulse" /></td>
                </tr>
              ))
            ) : businesses.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
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
                  </td>
                  <td className="py-4">
                    {business.address && (
                      <div className="text-white">{business.address}</div>
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