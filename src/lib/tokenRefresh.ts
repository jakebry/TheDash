import { createClient } from '@supabase/supabase-js';

// Cache for tracking the last refresh time
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 10000; // 10 seconds minimum between refreshes
const BACKOFF_RESET_DELAY = 60000; // Reset backoff after 1 minute of no failures

// State to track consecutive failures for backoff
let consecutiveFailures = 0;
let backoffTimeout: NodeJS.Timeout | null = null;
let refreshPromise: Promise<void> | null = null;

// Function to get the current backoff delay
const getBackoffDelay = (): number => {
  if (consecutiveFailures === 0) return 0;
  // Exponential backoff: 2^n * 1000ms, with maximum of 1 minute
  return Math.min(Math.pow(2, consecutiveFailures) * 1000, 60000);
};

// Reset backoff counters
const resetBackoff = () => {
  consecutiveFailures = 0;
  if (backoffTimeout) {
    clearTimeout(backoffTimeout);
    backoffTimeout = null;
  }
};

// Schedule a backoff reset
const scheduleBackoffReset = () => {
  if (backoffTimeout) clearTimeout(backoffTimeout);
  backoffTimeout = setTimeout(resetBackoff, BACKOFF_RESET_DELAY);
};

/**
 * Throttled and managed session refresh with backoff strategy
 */
export const refreshSession = async (supabase: ReturnType<typeof createClient>): Promise<void> => {
  const now = Date.now();
  
  // If we already have a refresh in progress, return that promise
  if (refreshPromise) {
    return refreshPromise;
  }
  
  // Check if we need to wait due to rate limiting
  const timeSinceLastRefresh = now - lastRefreshTime;
  const backoffDelay = getBackoffDelay();
  
  // Skip if we've refreshed recently, unless we're in a backoff state
  if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL && consecutiveFailures === 0) {
    console.log('Skipping token refresh - too soon');
    return Promise.resolve();
  }
  
  // If we're in a backoff state and haven't waited enough, skip
  if (backoffDelay > 0 && timeSinceLastRefresh < backoffDelay) {
    console.log(`Skipping token refresh - in backoff (${backoffDelay}ms)`);
    return Promise.resolve();
  }
  
  // Create a new refresh promise
  refreshPromise = new Promise<void>(async (resolve) => {
    try {
      // Update the last refresh time
      lastRefreshTime = now;
      
      // Attempt to refresh the session
      const { error } = await supabase.auth.refreshSession();
      
      if (error) {
        // If we get an error, increment the backoff counter
        consecutiveFailures++;
        console.error(`Token refresh error (attempt ${consecutiveFailures}):`, error);
        scheduleBackoffReset();
      } else {
        // On success, reset the backoff counter
        resetBackoff();
      }
    } catch (error) {
      // Handle any unexpected errors
      consecutiveFailures++;
      console.error(`Unexpected refresh error (attempt ${consecutiveFailures}):`, error);
      scheduleBackoffReset();
    } finally {
      // Clear the promise reference and resolve
      const currentPromise = refreshPromise;
      setTimeout(() => {
        if (refreshPromise === currentPromise) {
          refreshPromise = null;
        }
      }, 100);
      resolve();
    }
  });
  
  return refreshPromise;
};

/**
 * Force JWT refresh with rate limiting
 */
export const forceJwtRefresh = async (supabase: ReturnType<typeof createClient>): Promise<void> => {
  await refreshSession(supabase);
  try {
    // Only call the RPC if we successfully refreshed the session
    if (consecutiveFailures === 0) {
      await supabase.rpc('force_jwt_refresh');
    }
  } catch (error) {
    console.error('Error forcing JWT refresh:', error);
  }
};