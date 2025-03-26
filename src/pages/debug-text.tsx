import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function DebugRole() {
  useEffect(() => {
    const runTest = async () => {
      const { data, error } = await supabase.rpc('update_user_role_with_validation', {
        target_user_id: '27706516-0e9d-4d01-bdca-31ce4f939a61',
        new_role: 'business'
      });

      console.log('RPC Response:', { data, error });
    };

    runTest();
  }, []);

  return <div>Testing RPC...</div>;
}
