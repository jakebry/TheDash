import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './ImageCropModal.css';

interface ImageCropModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

export function ImageCropModal({ imageUrl, onClose, onSave }: ImageCropModalProps) {
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5,
  });
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleSave = () => {
    if (!imgRef.current || !completedCrop) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-highlight-blue p-6 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Crop Your Photo</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden flex items-center justify-center">
          {isLoading && (
            <div className="w-full h-32 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
            </div>
          )}
          
          <div className={`crop-container-wrapper max-h-[60vh] overflow-auto ${isLoading ? 'hidden' : 'block'}`}>
            <ReactCrop
              crop={crop}
              onChange={c => setCrop(c)}
              onComplete={c => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              minWidth={100}
              minHeight={100}
              className="crop-container"
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Crop preview"
                className="max-w-full object-contain max-h-[55vh]"
                onLoad={handleImageLoad}
              />
            </ReactCrop>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Save Photo
          </button>
        </div>
      </div>
    </div>
  );
}