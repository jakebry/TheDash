import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ImageCropModal } from './ImageCropModal';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_DIMENSION = 1200; // Maximum width/height for displayed image

interface ProfilePhotoProps {
  avatarUrl: string | null;
  onPhotoUpdate: (url: string) => void;
}

export function ProfilePhoto({ avatarUrl, onPhotoUpdate }: ProfilePhotoProps) {
  const [uploading, setUploading] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 100MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_IMAGE_DIMENSION;
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = (width / height) * MAX_IMAGE_DIMENSION;
            height = MAX_IMAGE_DIMENSION;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0, width, height);
        const resizedImage = canvas.toDataURL('image/jpeg', 0.9);
        setTempImageUrl(resizedImage);
        setShowCropModal(true);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (croppedImageBlob: Blob) => {
    try {
      setUploading(true);
      setShowCropModal(false);

      const fileName = `${Math.random()}.png`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImageBlob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Try using the RPC function first (most reliable)
      const { error: rpcError } = await supabase.rpc('update_user_avatar', {
        user_id: user?.id,
        avatar_url: publicUrl
      });
      
      if (rpcError) {
        console.warn('Error updating via RPC:', rpcError);
        
        // Fallback to direct profile update
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user?.id);
          
        if (updateProfileError) {
          throw updateProfileError;
        }
      }

      onPhotoUpdate(publicUrl);
      setTempImageUrl(null);
      toast.success('Profile photo updated successfully!');
    } catch (error) {
      toast.error('Error updating profile photo');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-highlight-blue rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-white mb-4">Profile Photo</h2>
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-neon-blue/20 flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl text-white">
              {user?.email?.[0].toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload New Photo'}
          </button>
          <p className="text-sm text-gray-400 mt-2">
            Recommended: Square image, at least 400x400px
          </p>
        </div>
      </div>

      {showCropModal && tempImageUrl && (
        <ImageCropModal
          imageUrl={tempImageUrl}
          onClose={() => {
            setShowCropModal(false);
            setTempImageUrl(null);
          }}
          onSave={handleUpload}
        />
      )}
    </div>
  );
}