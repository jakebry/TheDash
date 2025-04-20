import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { refreshSession } from '../lib/tokenRefresh';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Make sure this exists!

type TypedSupabase = SupabaseClient<Database>;

export function useRole(userId: string | null = null) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const client = supabase as TypedSupabase;

  useEffect(() => {
    const getRole = async () => {
      try {
        await refreshSession(client);
        const { data: sessionData } = await client.auth.getSession();
        const sessionUser = sessionData?.session?.user;

        if (!sessionUser && !userId) {
          setRole(null);
          setLoading(false);
          return;
        }

        const targetUserId = userId || sessionUser?.id;
        if (!targetUserId) {
          setRole(null);
          setLoading(false);
          return;
        }

        const appMetadataRole = sessionUser?.app_metadata?.role;
        const userMetadataRole = sessionUser?.user_metadata?.role;

        if (appMetadataRole || userMetadataRole) {
          setRole(appMetadataRole || userMetadataRole);
          setLoading(false);
          await client.rpc('ensure_profile_exists', { user_id: targetUserId });
          return;
        }

        const { data, error } = await client
          .from('profiles')
          .select('role')
          .eq('id', targetUserId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching role from profiles:', error);
          try {
            await client.rpc('ensure_profile_exists', { user_id: targetUserId });

            const { data: roleData } = await client.rpc('get_all_auth_roles', {
              target_id: targetUserId,
            });

            if (roleData) {
              if (
                roleData.is_admin_in_jwt ||
                roleData.is_admin_in_profile ||
                roleData.is_admin_in_user_metadata ||
                roleData.is_admin_in_app_metadata
              ) {
                setRole('admin');
              } else if (
                roleData.profile_role === 'business' ||
                roleData.user_metadata_role === 'business' ||
                roleData.app_metadata_role === 'business'
              ) {
                setRole('business');
              } else {
                setRole('user');
              }
            } else {
              setRole('user');
            }
          } catch (rpcError) {
            console.error('RPC fallback failed:', rpcError);
            setRole('user');
          }
        } else if (data?.role) {
          setRole(data.role);
        } else {
          setRole('user');
        }
      } catch (error) {
        console.error('General exception during role fetch:', error);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    getRole();
  }, [userId]);

  const refreshRole = async () => {
    setLoading(true);
    try {
      await refreshSession(client);

      const { data: roleData } = await client.rpc('get_all_auth_roles', {
        target_id: userId,
      });

      if (roleData) {
        if (
          roleData.is_admin_in_jwt ||
          roleData.is_admin_in_profile ||
          roleData.is_admin_in_user_metadata ||
          roleData.is_admin_in_app_metadata
        ) {
          setRole('admin');
        } else if (
          roleData.profile_role === 'business' ||
          roleData.user_metadata_role === 'business' ||
          roleData.app_metadata_role === 'business'
        ) {
          setRole('business');
        } else {
          setRole('user');
        }
      } else {
        const { data } = await client
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        setRole(data?.role || 'user');
      }
    } catch (error) {
      console.error('Error refreshing role:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentRole = () => role;

  return { role, loading, refreshRole, getCurrentRole };
}
