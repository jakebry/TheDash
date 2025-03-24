import { useAuth } from '../../contexts/useAuth';
import toast from 'react-hot-toast';

interface PersonalInfoProps {
  fullName: string;
  onFullNameChange: (name: string) => void;
}

const roleColors = {
  admin: 'bg-purple-500',
  business: 'bg-emerald-500',
  user: 'bg-blue-500',
};

export function PersonalInfo({ fullName, onFullNameChange }: PersonalInfoProps) {
  const { user } = useAuth();
  const role = (user?.user_metadata?.role ?? 'user') as 'admin' | 'business' | 'user';

  const updateProfile = async () => {
    try {
      if (!user?.id) return;

      const res = await fetch('/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, full_name: fullName }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      toast.success('Profile updated');
    } catch (err) {
      toast.error('Failed to update profile');
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${roleColors[role]}`} />
        <p className="text-sm text-gray-400">Role: {role}</p>
      </div>

      <label className="block text-sm text-gray-300">Full Name</label>
      <input
        type="text"
        value={fullName}
        onChange={(e) => onFullNameChange(e.target.value)}
        className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-600 text-white"
      />

      <button
        onClick={updateProfile}
        className="px-4 py-2 bg-neon-blue text-white rounded hover:bg-blue-600"
      >
        Save Changes
      </button>
    </div>
  );
}
