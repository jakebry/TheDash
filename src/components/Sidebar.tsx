import { Home, MessageSquare, Clock, Building2, LogOut, Settings as SettingsIcon, Shield } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useRole } from '../hooks/useRole';

export default function Sidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { role } = useRole(user?.id ?? null);

  const links = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Building2, label: 'Business', path: '/business' },
    { icon: Clock, label: 'Time Clock', path: '/time-clock' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-highlight-blue p-4 flex flex-col">
      <div className="flex items-center gap-2 px-2 mb-8">
        <MessageSquare className="w-8 h-8 text-neon-blue" />
        <span className="text-xl font-bold">WestEdge</span>
      </div>

      <nav className="flex-1">
        <ul className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-neon-blue text-white'
                      : 'text-gray-300 hover:bg-light-blue'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {role === 'admin' && (
        <div className="mb-4">
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              location.pathname === '/admin'
                ? 'bg-purple-500 text-white'
                : 'text-gray-300 hover:bg-light-blue'
            }`}
          >
            <Shield className="w-5 h-5" />
            Admin Settings
          </Link>
        </div>
      )}

      <button
        onClick={() => signOut()}
        className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-light-blue rounded-lg transition-colors mt-auto"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </aside>
  );
}