import { useState, useRef } from 'react';
import { Settings as SettingsIcon, X, Upload } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);

      if (updateError) {
        throw updateError;
      }

      toast.success('Profile photo updated successfully!');
      // Force reload to show the new avatar
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error('Error updating profile photo');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const updateNickname = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: nickname })
        .eq('id', user?.id);

      if (error) throw error;
      toast.success('Nickname updated successfully!');
      setIsOpen(false);
      // Force reload to show the new nickname
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error('Error updating nickname');
      console.error(error);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-light-blue rounded-lg transition-colors"
      >
        <SettingsIcon className="w-5 h-5" />
        Settings
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-highlight-blue p-6 rounded-xl w-full max-w-md relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-semibold mb-6 text-white">Profile Settings</h2>

            <div className="space-y-6">
              {/* Profile Photo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-neon-blue/20 flex items-center justify-center overflow-hidden">
                    {user?.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-white">
                        {user?.email?.[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </button>
                </div>
              </div>

              {/* Nickname */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter your nickname"
                  className="w-full px-4 py-2 bg-light-blue border border-highlight-blue rounded-lg text-white focus:outline-none focus:border-neon-blue transition-colors"
                />
              </div>

              <button
                onClick={updateNickname}
                className="w-full py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}