import { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface DeleteBusinessModalProps {
  businessId: string;
  businessName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteBusinessModal({ 
  businessId, 
  businessName, 
  onClose, 
  onDeleted 
}: DeleteBusinessModalProps) {
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [verificationPhrase, setVerificationPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [step, setStep] = useState(1);

  const handleFirstConfirmation = () => {
    if (confirmationPhrase !== 'DELETE') {
      toast.error('Please type "DELETE" to confirm');
      return;
    }
    setStep(2);
  };

  const handleDelete = async () => {
    if (verificationPhrase !== 'CONFIRM DELETE') {
      toast.error('Please type "CONFIRM DELETE" to verify');
      return;
    }

    try {
      setIsDeleting(true);
      
      const { data, error } = await supabase.rpc('delete_business', {
        p_business_id: businessId,
        p_confirmation_phrase: confirmationPhrase,
        p_verification_phrase: verificationPhrase
      });
      
      if (error) throw error;
      
      if (!data.success) {
        toast.error(data.message || 'Failed to delete business');
        return;
      }
      
      toast.success(data.message || 'Business deleted successfully');
      onDeleted();
    } catch (error) {
      console.error('Error deleting business:', error);
      toast.error('Failed to delete business');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-highlight-blue rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Delete Business</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={isDeleting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-t border-b border-gray-700 py-4 my-4">
          {step === 1 ? (
            <div>
              <div className="flex items-start gap-3 mb-4 p-3 bg-red-900/30 rounded-lg border border-red-500/30">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white mb-1">Warning: This action cannot be undone</p>
                  <p className="text-sm text-gray-300">
                    Deleting <span className="font-semibold text-white">{businessName}</span> will permanently remove all associated data including:
                  </p>
                  <ul className="list-disc text-sm text-gray-300 ml-4 mt-1 space-y-1">
                    <li>All business information</li>
                    <li>All team members and roles</li>
                    <li>All projects and their data</li>
                    <li>All messages and chat history</li>
                  </ul>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                  placeholder="Type DELETE here"
                  autoComplete="off"
                  disabled={isDeleting}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 hover:text-white"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFirstConfirmation}
                  disabled={confirmationPhrase !== 'DELETE' || isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Proceed
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 mb-4 p-3 bg-red-900/30 rounded-lg border border-red-500/30">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white mb-1">Final Verification Required</p>
                  <p className="text-sm text-gray-300">
                    You are about to permanently delete <span className="font-semibold text-white">{businessName}</span>. 
                    This action <span className="font-bold text-red-400">CANNOT</span> be reversed.
                  </p>
                  <p className="text-sm text-gray-300 mt-2">
                    Are you absolutely sure you want to proceed?
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type <span className="font-mono font-bold text-red-400">CONFIRM DELETE</span> to permanently delete this business
                </label>
                <input
                  type="text"
                  value={verificationPhrase}
                  onChange={(e) => setVerificationPhrase(e.target.value)}
                  className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                  placeholder="Type CONFIRM DELETE here"
                  autoComplete="off"
                  disabled={isDeleting}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-gray-300 hover:text-white"
                  disabled={isDeleting}
                >
                  Back
                </button>
                <button
                  onClick={handleDelete}
                  disabled={verificationPhrase !== 'CONFIRM DELETE' || isDeleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 text-center">
          This action will notify all members that the business has been deleted.
        </div>
      </div>
    </div>
  );
}