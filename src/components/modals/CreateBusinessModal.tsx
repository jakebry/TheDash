import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { useRole } from '../../hooks/useRole';
import { refreshSession } from '../../lib/tokenRefresh';
import toast from 'react-hot-toast';

interface CreateBusinessModalProps {
  onClose: () => void;
}

export function CreateBusinessModal({ onClose }: CreateBusinessModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const { user } = useAuth();
  const { role, loading: roleLoading, refreshRole } = useRole(user?.id ?? null);

  useEffect(() => {
    const verifyBusinessAccess = async () => {
      setCheckingRole(true);
      try {
        await refreshSession(supabase);
        await refreshRole();

        if (role !== 'business') {
          const { data } = await supabase.rpc('get_all_auth_roles');

          if (data && (
            data.profile_role === 'business' || 
            data.user_metadata_role === 'business' || 
            data.app_metadata_role === 'business' ||
            data.jwt_role === 'business'
          )) {
            await supabase.rpc('fully_sync_user_role');
            await refreshRole();

            if (role !== 'business') {
              toast.error(
                'Your business role may not be fully active. Try logging out and back in.',
                { duration: 5000 }
              );
            }
          }
        }
      } catch (error) {
        console.error('Error verifying business access:', error);
      } finally {
        setCheckingRole(false);
      }
    };

    verifyBusinessAccess();
  }, []);

  const canCreateBusiness = () => {
    return role === 'business' || role === 'admin';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!canCreateBusiness()) {
      toast.error("You do not have permission to create a business.");
      return;
    }

    try {
      setLoading(true);

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name,
          description: `${name} is a registered business.`,
          created_by: user.id,
          phone_number: phone,
          address,
          website: website || null
        })
        .select()
        .single();

      if (businessError || !business) throw businessError;

      const { data: ownerRole, error: roleError } = await supabase
        .from('business_user_roles')
        .select('id')
        .eq('role', 'owner')
        .single();

      if (roleError || !ownerRole) {
        toast.error('Failed to assign owner role to creator.');
        return;
      }

      const { error: memberError } = await supabase
        .from('business_members')
        .insert({
          business_id: business.id,
          user_id: user.id,
          role_id: ownerRole.id
        });

      if (memberError) throw memberError;

      toast.success('Business created successfully!');
      onClose();
    } catch (error) {
      console.error('Error creating business:', error);
      toast.error('Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-highlight-blue p-6 rounded-xl w-full max-w-md relative">
        {(!canCreateBusiness() && !checkingRole && !roleLoading) && (
          <div className="absolute inset-0 bg-highlight-blue/95 flex items-center justify-center rounded-xl z-10">
            <div className="text-center p-6">
              <p className="text-red-500 font-medium mb-2">Access Denied</p>
              <p className="text-gray-400">You need business privileges to create a company.</p>
              <p className="text-gray-400 mt-3">
                If you were recently granted business privileges, 
                please try logging out and logging back in.
              </p>
            </div>
          </div>
        )}

        {(checkingRole || roleLoading) && (
          <div className="absolute inset-0 bg-highlight-blue/95 flex items-center justify-center rounded-xl z-10">
            <div className="text-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue mx-auto mb-4"></div>
              <p className="text-gray-200">Verifying your access...</p>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-6">Create Your Business</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Business Name *
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Business Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Website (Optional)
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              placeholder="https://"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !canCreateBusiness() || checkingRole || roleLoading}
            className="w-full py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Business'}
          </button>
        </form>
      </div>
    </div>
  );
}
