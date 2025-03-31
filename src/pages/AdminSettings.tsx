import { useState, useEffect } from 'react';
import { Users, Building2, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';
import { UserManagement } from '../components/admin/UserManagement';
import { BusinessManagement } from '../components/admin/BusinessManagement';
import { useAuth } from '../contexts/useAuth';
import { useRole } from '../hooks/useRole';

interface UserStats {
  total_users: number;
  total_businesses: number;
  active_users_last_week: number;
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const { count: businessCount } = await supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true });

        const { count: activeUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        setStats({
          total_users: userCount || 0,
          total_businesses: businessCount || 0,
          active_users_last_week: activeUsers || 0,
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        toast.error('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (!user || roleLoading) return <p>Loading...</p>;
  if (role !== 'admin') return <Navigate to="/dashboard" />;

  return (
    <Layout>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
        <StatCard icon={<Users />} label="Total Users" value={stats?.total_users ?? 0} />
        <StatCard icon={<Building2 />} label="Businesses" value={stats?.total_businesses ?? 0} />
        <StatCard icon={<AlertCircle />} label="Active This Week" value={stats?.active_users_last_week ?? 0} />
      </div>
      <BusinessManagement />
      <UserManagement />
    </Layout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-highlight-blue text-white rounded-xl p-4 flex items-center space-x-4">
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="text-sm text-gray-300">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
}
