import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useState } from 'react';

export function PromoteToAdminButton() {
  const { user, loading } = useAuth();
  const [promoting, setPromoting] = useState(false);

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  if (user.email?.toLowerCase() !== 'jakebry22@gmail.com') return null;

  const promote = async () => {
    try {
      setPromoting(true);
      
      // First update the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }
      
      // Now update the user metadata
      // This may fail with 500 error due to permissions, but we'll try anyway
      try {
        const { error: metadataError } = await supabase.rpc('update_user_role', {
          user_id: user.id,
          new_role: 'admin'
        });
        
        if (metadataError) {
          console.warn('Could not update user metadata directly:', metadataError);
          // We'll continue despite this error since the profiles table was updated
        }
      } catch (metadataError) {
        console.warn('RPC call failed:', metadataError);
        // Continue despite this error
      }
      
      // Create a notification about the role change
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'Admin Access Granted',
          message: 'You now have administrator privileges',
          type: 'role_change',
          metadata: { new_role: 'admin', previous_role: 'user' }
        });
      
      toast.success('You are now an admin');
      
      // Force page refresh to apply new role
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Failed to promote user:', error);
      toast.error('Failed to promote user');
    } finally {
      setPromoting(false);
    }
  };

  return (
    <button
      onClick={promote}
      disabled={promoting}
      className="text-sm text-white px-4 py-2 bg-yellow-600 rounded mt-4 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {promoting ? 'Promoting...' : 'Promote to Admin'}
    </button>
  );
}