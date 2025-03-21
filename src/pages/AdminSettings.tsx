import { useState, useEffect } from 'react';
import { Users, Building2, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';
import { UserManagement } from '../components/admin/UserManagement';

interface UserStats {
  total_users: number;
  total_businesses: number;
  active_users_last_week: number;
}

export default function AdminSettings() {
  const { isAdmin, loading: roleLoading } = useRole();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get total users
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Get total businesses
        const { count: businessCount } = await supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true });

        // Get active users in last week
        const { count: activeUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        setStats({
          total_users: userCount || 0,
          total_businesses: businessCount || 0,
          active_users_last_week: activeUsers || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        toast.error('Failed to load admin statistics');
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  if (roleLoading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const StatCard = ({ icon: Icon, title, value }: { icon: any, title: string, value: number }) => (
    <div className="bg-highlight-blue rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-neon-blue/10 rounded-lg">
          <Icon className="w-6 h-6 text-neon-blue" />
        </div>
        <h3 className="text-lg font-medium text-white">{title}</h3>
      </div>
      <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <span className="px-2 py-1 text-xs font-medium bg-purple-500 text-white rounded-md">
            Admin
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-highlight-blue rounded-xl p-6 animate-pulse">
                <div className="h-14 bg-light-blue/50 rounded-lg mb-4" />
                <div className="h-8 bg-light-blue/50 rounded-lg w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              icon={Users}
              title="Total Users"
              value={stats?.total_users || 0}
            />
            <StatCard
              icon={Building2}
              title="Total Businesses"
              value={stats?.total_businesses || 0}
            />
            <StatCard
              icon={AlertCircle}
              title="Active Last Week"
              value={stats?.active_users_last_week || 0}
            />
          </div>
        )}
        <UserManagement />
      </div>
    </Layout>
  );
}