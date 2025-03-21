import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';


export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="bg-highlight-blue px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-light-blue rounded-full transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neon-blue flex items-center justify-center">
            {user?.email?.[0].toUpperCase()}
          </div>
        </div>
      </div>
    </nav>
  );
}