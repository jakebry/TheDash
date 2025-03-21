import { KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export function Security() {
  const { user } = useAuth();

  const initiatePasswordReset = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: `${window.location.origin}/update-password`,
      });
      
      if (error) throw error;
      toast.success('Password reset email sent!');
    } catch (error) {
      toast.error('Error sending password reset email');
      console.error(error);
    }
  };

  return (
    <div className="bg-highlight-blue rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Security</h2>
      <button
        onClick={initiatePasswordReset}
        className="flex items-center gap-2 px-4 py-2 bg-light-blue text-white rounded-lg hover:bg-highlight-blue transition-colors w-full justify-center"
      >
        <KeyRound className="w-4 h-4" />
        Change Password
      </button>
    </div>
  );
}