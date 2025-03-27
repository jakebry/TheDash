import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook to fetch and track a user's role from Supabase metadata or profiles.
 */
export function useRole(userId: string | null = null) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getRole = async () => {
      try {
        await supabase.auth.refreshSession(); // ✅ Always refresh session before fetching
        const { data: sessionData } = await supabase.auth.getSession();
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

        // Prioritize fast role detection from JWT / user metadata
        const appMetadataRole = sessionUser?.app_metadata?.role;
        const userMetadataRole = sessionUser?.user_metadata?.role;

        if (appMetadataRole) {
          setRole(appMetadataRole);
          setLoading(false);
          return;
        }

        if (userMetadataRole) {
          setRole(userMetadataRole);
          setLoading(false);
          return;
        }

        // Fallback to profiles table
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', targetUserId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching role from profiles:', error);
          try {
            const { data: roleData } = await supabase.rpc('get_all_auth_roles', { target_id: targetUserId });

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
      await supabase.auth.refreshSession(); // ✅ Proactive refresh

      const { data: roleData } = await supabase.rpc('get_all_auth_roles', {
        target_id: userId
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
        const { data } = await supabase
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
