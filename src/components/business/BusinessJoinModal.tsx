import { useState } from 'react';
import { X, Check, Building2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface BusinessJoinModalProps {
  businessId: string;
  businessName: string;
  notificationId: string;
  inviterName: string;
  onClose: () => void;
}

export function BusinessJoinModal({ 
  businessId, 
  businessName, 
  notificationId, 
  inviterName,
  onClose 
}: BusinessJoinModalProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const handleJoin = async () => {
    try {
      setIsJoining(true);
      
      // Create a new business_member entry
      const { error: memberError } = await supabase
        .from('business_members')
        .insert({
          business_id: businessId,
          user_id: (await supabase.auth.getSession()).data.session?.user.id,
          role: 'user' // Default role for invited members
        });
        
      if (memberError) throw memberError;
      
      // Mark the notification as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      toast.success(`You've joined ${businessName}`);
      onClose();
    } catch (error) {
      console.error('Error joining business:', error);
      toast.error('Failed to join business');
    } finally {
      setIsJoining(false);
    }
  };

  const handleDecline = async () => {
    try {
      setIsDeclining(true);
      
      // Mark the notification as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      toast.success('Invitation declined');
      onClose();
    } catch (error) {
      console.error('Error declining invitation:', error);
      toast.error('Failed to decline invitation');
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-highlight-blue p-6 rounded-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Business Invitation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-neon-blue" />
          </div>
          
          <h3 className="text-lg font-medium text-white mb-2">
            Join {businessName}?
          </h3>
          
          <p className="text-gray-300 mb-6">
            {inviterName} has invited you to join their business. Would you like to accept this invitation?
          </p>
          
          <div className="bg-light-blue/50 p-4 rounded-lg w-full mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-neon-blue mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                By joining, you'll be able to access business resources, participate in team activities, and communicate with other members.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 w-full">
            <button
              onClick={handleDecline}
              disabled={isDeclining || isJoining}
              className="flex-1 py-2 border border-gray-600 text-white rounded-lg hover:bg-light-blue transition-colors disabled:opacity-50"
            >
              {isDeclining ? 'Declining...' : 'Decline'}
            </button>
            
            <button
              onClick={handleJoin}
              disabled={isJoining || isDeclining}
              className="flex-1 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isJoining ? 'Joining...' : (
                <>
                  <Check className="w-4 h-4" />
                  Join
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}