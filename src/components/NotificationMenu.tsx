import { useState, useEffect, useRef } from 'react';
import { Bell, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import { CreateBusinessModal } from './modals/CreateBusinessModal';
import { BusinessJoinModal } from './business/BusinessJoinModal';
import toast from 'react-hot-toast';
import { refreshSession } from '../lib/tokenRefresh';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: string;
  metadata: Record<string, any>;
  business_id?: string;
}

export function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showJoinBusinessModal, setShowJoinBusinessModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Fetch initial notifications
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Ensure we have a valid session before proceeding
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Authentication error. Please try refreshing the page.');
          setIsLoading(false);
          return;
        }
        
        if (!sessionData.session) {
          console.warn('No active session');
          setError('No active session. Please log in again.');
          setIsLoading(false);
          return;
        }

        // Ensure profile exists before fetching notifications
        if (user?.id) {
          try {
            await supabase.rpc('ensure_profile_exists', { user_id: user.id });
          } catch (profileError) {
            console.warn('Profile check error:', profileError);
            // Continue anyway, as this is non-critical
          }
        }

        // Fetch notifications with proper error handling
        try {
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) {
            throw error;
          }

          setNotifications(data || []);
        } catch (fetchError: any) {
          console.error('Error fetching notifications:', fetchError);
          setError(`Failed to load notifications: ${fetchError.message || 'Unknown error'}`);
          setNotifications([]);
          
          // If we haven't retried too many times, try again
          if (retryCount < 3) {
            setRetryCount(retryCount + 1);
            setTimeout(() => fetchNotifications(), 2000); // Retry after 2 seconds
          }
        }
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load notifications';
        console.error('General error in notifications:', errorMessage);
        
        // Only show toast for non-session errors
        if (errorMessage !== 'No active session') {
          toast.error(errorMessage);
        }
        
        setNotifications([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchNotifications();

    // Subscribe to new notifications with better error handling
    const setupSubscription = async () => {
      try {
        // Refresh session before subscribing (using throttled refreshSession)
        await refreshSession(supabase);
        
        // Ensure we have a valid user ID
        if (!user?.id) {
          console.warn('No user ID available for notification subscription');
          return null;
        }
        
        const subscription = supabase
          .channel('notifications')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications'
          }, async (payload) => {
            // Filter notifications client-side to avoid subscription issues
            if (payload.new.user_id === user.id) {
            // No need to refresh session here - handled by throttled refreshSession if needed
            setNotifications(prev => [payload.new as Notification, ...prev]);
            toast.success('New notification received!', {
              icon: '🔔',
            });
            
            // Handle role-specific notifications
            if (payload.new.type === 'role_change') {
              // Role change notifications might require additional UI feedback
              const newRole = payload.new.metadata?.new_role;
              if (newRole) {
                toast.success(`Your role has been updated to ${newRole}`, {
                  duration: 5000,
                  icon: '👑'
                });
                
                // If role changed from something else to admin, suggest page refresh
                if (newRole === 'admin') {
                  toast.success('Please refresh the page to apply new admin permissions', {
                    duration: 8000,
                    icon: '⚠️'
                  });
                }
              }
            }
            }
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications'
          }, (payload) => {
            // Filter updates client-side
            if (payload.new.user_id === user.id) {
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
            );
            }
          })
          .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications'
          }, (payload) => {
            // Filter deletes client-side
            if (payload.old.user_id === user.id) {
            setNotifications(prev => 
              prev.filter(n => n.id !== payload.old.id)
            );
            }
          })
          .subscribe({
            callback: (status, err) => {
              if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to notifications');
              } else if (status === 'CHANNEL_ERROR') {
                console.error('Failed to subscribe to notifications:', err);
                toast.error('Failed to subscribe to notifications');
              } else if (status === 'TIMED_OUT') {
                console.warn('Subscription timed out, retrying...');
                // Implement retry after timeout
                setTimeout(() => {
                  subscription.subscribe();
                }, 2000);
              }
            }
          });
          
        return subscription;
      } catch (error) {
        console.error('Error setting up subscription:', error);
        toast.error('Failed to set up notifications');
        return null;
      }
    };
    
    // Set up subscription
    const subscriptionPromise = setupSubscription();
    
    // Refresh notifications every 30 seconds as backup
    const refreshInterval = setInterval(fetchNotifications, 30000);

    // Handle click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      // Clean up subscription
      subscriptionPromise.then(subscription => {
        if (subscription) subscription.unsubscribe();
      });
      clearInterval(refreshInterval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user, retryCount]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      // Check if there are any unread notifications
      const unreadNotifications = notifications.filter(n => !n.read);
      if (!user?.id || unreadNotifications.length === 0) return;
      
      setIsMarkingRead(true);
      
      // Get IDs of all unread notifications
      const unreadIds = unreadNotifications.map(n => n.id);
      
      // Update all unread notifications in a single operation
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);

      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    } finally {
      setIsMarkingRead(false);
    }
  };
  
  const deleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the notification click
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.filter(n => n.id !== notificationId)
      );
      
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };
  
  const clearAllNotifications = async () => {
    try {
      if (!user?.id || notifications.length === 0) return;
      
      setIsDeleting(true);
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Update local state
      setNotifications([]);
      
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Handle business role notifications
    if ((notification.type === 'business_role' && notification.metadata?.action === 'create_business') ||
        (notification.type === 'role_change' && notification.metadata?.new_role === 'business')) {
      
      // Use throttled session refresh
      await refreshSession(supabase);
      
      const { data: roleData } = await supabase.rpc('get_all_auth_roles');
      
      if (roleData?.profile_role === 'business' || roleData?.jwt_role === 'business') {
        // Role is properly set, show the modal
        setShowBusinessModal(true);
      } else {
        // Role not properly set, try to activate it
        try {
          const { data: activationResult } = await supabase.rpc('activate_business_role', {
            user_id: user?.id
          });
          
          if (activationResult) {
            // Refresh session one more time after activation
            await refreshSession(supabase);
            setShowBusinessModal(true);
          } else {
            toast.error('Could not activate business role. Please try logging out and back in.');
          }
        } catch (error) {
          console.error('Error activating business role:', error);
          toast.error('Please try logging out and logging back in to activate your business role.');
        }
      }
    }
    
    // Handle business invitation
    if (notification.type === 'business_invitation') {
      setSelectedNotification(notification);
      setShowJoinBusinessModal(true);
    }
    
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }
  };

  // Get notification icon and color based on type
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'role_change':
        return { 
          bgColor: 'bg-purple-500/20', 
          borderColor: 'border-purple-500/30' 
        };
      case 'business_invitation':
      case 'business_role':
        return { 
          bgColor: 'bg-emerald-500/20', 
          borderColor: 'border-emerald-500/30' 
        };
      case 'security':
        return { 
          bgColor: 'bg-amber-500/20', 
          borderColor: 'border-amber-500/30' 
        };
      default:
        return { 
          bgColor: 'bg-light-blue/50', 
          borderColor: 'border-blue-500/30' 
        };
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-light-blue rounded-full transition-colors relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-coral-orange text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-highlight-blue rounded-xl shadow-lg overflow-hidden z-50">
          <div className="p-4 border-b border-light-blue flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            {error && (
              <div className="text-sm text-red-400">
                {error}
              </div>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                disabled={isDeleting}
                className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
                {isDeleting ? 'Clearing...' : 'Clear All'}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No notifications
              </div>
            ) : (
              <div className="divide-y divide-light-blue">
                {notifications.map(notification => {
                  const { bgColor, borderColor } = getNotificationStyle(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-light-blue/30 transition-colors cursor-pointer relative group ${
                        !notification.read ? `${bgColor}` : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <button
                        onClick={(e) => deleteNotification(notification.id, e)}
                        className="absolute right-2 top-2 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete notification"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      
                      <div className="flex items-start justify-between gap-4 pr-4">
                        <div>
                          <h4 className="font-medium text-white">{notification.title}</h4>
                          <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
                          {notification.type === 'role_change' && (
                            <div className={`mt-2 p-1.5 rounded text-xs ${borderColor} ${bgColor}`}>
                              {notification.metadata?.previous_role &&
                               notification.metadata?.new_role && (
                                <span>
                                  Changed from <span className="font-medium">{notification.metadata.previous_role}</span> to <span className="font-medium">{notification.metadata.new_role}</span>
                                </span>
                              )}
                            </div>
                          )}
                          {notification.type === 'business_invitation' && (
                            <div className={`mt-2 p-1.5 rounded text-xs ${borderColor} ${bgColor}`}>
                              <span>
                                From <span className="font-medium">{notification.metadata?.inviter_name || 'Unknown'}</span>
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {notifications.length > 0 && unreadCount > 0 && (
            <div className="p-3 border-t border-light-blue bg-highlight-blue/50 flex justify-between">
              <button
                onClick={markAllAsRead}
                disabled={isMarkingRead}
                className="text-sm text-neon-blue hover:text-blue-400 transition-colors w-full text-center disabled:opacity-50"
              >
                {isMarkingRead ? 'Marking as read...' : 'Mark all as read'}
              </button>
            </div>
          )}
        </div>
      )}
      
      {showBusinessModal && (
        <CreateBusinessModal onClose={() => setShowBusinessModal(false)} />
      )}

      {showJoinBusinessModal && selectedNotification && (
        <BusinessJoinModal 
          businessId={selectedNotification.metadata.business_id}
          businessName={selectedNotification.metadata.business_name}
          notificationId={selectedNotification.id}
          inviterName={selectedNotification.metadata.inviter_name || 'A business owner'}
          onClose={() => {
            setShowJoinBusinessModal(false);
            setSelectedNotification(null);
          }}
        />
      )}
    </div>
  );
}