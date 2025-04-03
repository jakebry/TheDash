import { Home, MessageSquare, Clock, Building2, LogOut, Settings as SettingsIcon, Shield, Briefcase } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useRole } from '../hooks/useRole';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { refreshSession } from '../lib/tokenRefresh';

export default function Sidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { role, loading } = useRole(user?.id ?? null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;
      
      // Multiple checks for admin status to ensure we detect it properly
      
      // 1. First check user metadata (fastest and most reliable)
      if (user.user_metadata?.role === 'admin') {
        setIsAdmin(true);
        return;
      }
      
      // 2. Check from role hook
      if (role === 'admin') {
        setIsAdmin(true);
        return;
      }
      
      // 3. Try a direct database fetch
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (!profileError && profileData?.role === 'admin') {
          setIsAdmin(true);
          return;
        }
      } catch (err) {
        console.warn('Profile check failed:', err);
      }
      
      // 4. As a last resort, call our helper function
      try {
        const { data: diagInfo } = await supabase.rpc('get_admin_diagnostic_info');
        
        // Check if any admin indicator exists
        if (diagInfo && (
          diagInfo.profile_role === 'admin' || 
          diagInfo.metadata_role === 'admin' ||
          diagInfo.app_metadata_role === 'admin' ||
          diagInfo.jwt_role === 'admin' ||
          diagInfo.is_admin_check === true ||
          diagInfo.is_admin_jwt_check === true
        )) {
          console.log('Admin detected via diagnostic check');
          setIsAdmin(true);
          return;
        }
        
        // If we're still here, try the sync function once
        const { data } = await supabase.rpc('fully_sync_user_role');
        
        // If sync indicates we're an admin, refresh the page to update JWT
        if (data && data.includes('role: admin')) {
          console.log('Admin role detected after sync, refreshing page');
          window.location.reload();
        }
      } catch (err) {
        console.warn('Admin check failed:', err);
      }
    };
    
    checkAdminStatus();
  }, [user, role]);

  const links = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Building2, label: 'Business', path: '/business' },
    { icon: Briefcase, label: 'Projects', path: '/projects' },
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
            const isActive = location.pathname.startsWith(link.path);
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
      
      {(isAdmin || role === 'admin') && (
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