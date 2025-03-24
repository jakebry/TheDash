import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export function PromoteToAdminButton() {
  const { user, loading } = useAuth();

  if (loading) {
    console.log('Auth is still loading...');
    return null;
  }

  if (!user) {
    console.warn('No user found.');
    return null;
  }

  console.log('Logged in as:', user.email);

  if (user.email?.toLowerCase() !== 'jakebry22@gmail.com') return null;

  const promote = async () => {
    const { error } = await supabase.auth.updateUser({
      data: {
        role: 'admin',
      },
    });

    if (error) {
      toast.error('Failed to promote user');
      console.error(error);
    } else {
      toast.success('You are now an admin');
    }
  };

  return (
    <button
      onClick={promote}
      className="text-sm text-white px-4 py-2 bg-yellow-600 rounded mt-4 hover:bg-yellow-700"
    >
      Promote to Admin
    </button>
  );
}
