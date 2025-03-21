import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { Avatar } from './Avatar';

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
          <Avatar />
        </div>
      </div>
    </nav>
  );
}