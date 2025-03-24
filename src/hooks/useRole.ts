import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSessionRole = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        setRole(null);
      } else {
        setRole(data.session.user.user_metadata?.role ?? null);
      }
      setLoading(false);
    };

    getSessionRole();
  }, []);

  return { role, loading };
}
