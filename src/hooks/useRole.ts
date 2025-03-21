import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRole(userId: string | null) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching role:', error);
        setRole(null);
      } else {
        setRole(data.role);
      }

      setLoading(false);
    };

    fetchRole();
  }, [userId]);

  return { role, loading };
}
