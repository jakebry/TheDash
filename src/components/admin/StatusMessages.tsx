import { AlertTriangle, User } from 'lucide-react';

interface StatusMessagesProps {
  error: string | null;
  debugInfo: string | null;
}

export function StatusMessages({ error, debugInfo }: StatusMessagesProps) {
  if (!error && !debugInfo) return null;

  return (
    <>
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-white">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">User Visibility Issue</p>
              <p className="text-sm text-gray-300 mt-1">{error}</p>
              <p className="text-sm text-gray-300 mt-2">Try clicking the "Verify Access" button to fix permission issues.</p>
            </div>
          </div>
        </div>
      )}
      
      {debugInfo && (
        <div className="mb-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg text-white">
          <div className="flex items-start gap-2">
            <User className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Debug Information</p>
              <p className="text-sm text-gray-300 mt-1">{debugInfo}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}