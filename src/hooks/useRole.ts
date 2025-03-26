import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRole(userId: string | null = null) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getRole = async () => {
      try {
        // First try to get current session
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData?.session?.user;
        
        if (!sessionUser && !userId) {
          // No session and no userId provided
          setRole(null);
          setLoading(false);
          return;
        }
        
        // Determine which user ID to look up
        const targetUserId = userId || sessionUser?.id;
        
        if (!targetUserId) {
          setRole(null);
          setLoading(false);
          return;
        }
        
        // First check if we already have the role in user metadata
        // This avoids an extra database query
        if (sessionUser && sessionUser.id === targetUserId) {
          // Check multiple places for the role with priority:
          // 1. JWT app_metadata (this is used for authorization)
          // 2. User metadata (this is persisted in the database)
          const appMetadataRole = sessionUser.app_metadata?.role;
          const userMetadataRole = sessionUser.user_metadata?.role;
          
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
        }
        
        // Get role from profiles table as a fallback
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', targetUserId)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching role:', error);
          // Attempt to get role through RPC if direct query fails
          try {
            const { data: roleData } = await supabase.rpc('get_all_auth_roles', { 
              target_id: targetUserId 
            });
            
            // Use the most authoritative role from multiple sources
            if (roleData) {
              if (roleData.is_admin_in_jwt || 
                  roleData.is_admin_in_profile || 
                  roleData.is_admin_in_user_metadata ||
                  roleData.is_admin_in_app_metadata) {
                setRole('admin');
              } else if (roleData.profile_role === 'business' || 
                        roleData.user_metadata_role === 'business' || 
                        roleData.app_metadata_role === 'business') {
                setRole('business');
              } else {
                setRole('user');
              }
            } else {
              setRole('user'); // Default fallback
            }
          } catch (rpcError) {
            console.error('RPC role check failed:', rpcError);
            setRole('user'); // Default fallback
          }
        } else if (data?.role) {
          setRole(data.role);
        } else {
          // Fallback if no profile found
          setRole('user');
        }
      } catch (error) {
        console.error('Exception in role fetch:', error);
        setRole('user'); // Default fallback
      } finally {
        setLoading(false);
      }
    };

    // Only fetch when component mounts or userId changes
    getRole();
  }, [userId]);

  // Force refresh role function - can be called after role updates
  const refreshRole = async () => {
    setLoading(true);
    try {
      // First try to get from JWT and auth
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user;
      
      if (!sessionUser && !userId) {
        setRole(null);
        return;
      }
      
      const targetUserId = userId || sessionUser?.id;
      
      // Fetch fresh role data from multiple sources
      const { data: roleData } = await supabase.rpc('get_all_auth_roles', { 
        target_id: targetUserId 
      });
      
      if (roleData) {
        // Determine highest privilege role
        if (roleData.is_admin_in_jwt || 
            roleData.is_admin_in_profile || 
            roleData.is_admin_in_user_metadata ||
            roleData.is_admin_in_app_metadata) {
          setRole('admin');
        } else if (roleData.profile_role === 'business' || 
                 roleData.user_metadata_role === 'business' || 
                 roleData.app_metadata_role === 'business') {
          setRole('business');
        } else {
          setRole('user');
        }
      } else {
        // Fallback to direct profile query
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', targetUserId)
          .maybeSingle();
          
        setRole(data?.role || 'user');
      }
    } catch (error) {
      console.error('Error refreshing role:', error);
    } finally {
      setLoading(false);
    }
  };

  return { role, loading, refreshRole };
}