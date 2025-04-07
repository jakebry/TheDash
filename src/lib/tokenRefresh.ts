import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Update this path if necessary

type TypedSupabase = SupabaseClient<Database>;

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
export const refreshSession = async (supabase: TypedSupabase): Promise<void> => {
  const now = Date.now();

  if (refreshPromise) {
    return refreshPromise;
  }

  const timeSinceLastRefresh = now - lastRefreshTime;
  const backoffDelay = getBackoffDelay();

  if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL && consecutiveFailures === 0) {
    console.log('Skipping token refresh - too soon');
    return Promise.resolve();
  }

  if (backoffDelay > 0 && timeSinceLastRefresh < backoffDelay) {
    console.log(`Skipping token refresh - in backoff (${backoffDelay}ms)`);
    return Promise.resolve();
  }

  refreshPromise = new Promise<void>(async (resolve) => {
    try {
      lastRefreshTime = now;

      const { error } = await supabase.auth.refreshSession();

      if (error) {
        consecutiveFailures++;
        console.error(`Token refresh error (attempt ${consecutiveFailures}):`, error);
        scheduleBackoffReset();
      } else {
        resetBackoff();
      }
    } catch (error) {
      consecutiveFailures++;
      console.error(`Unexpected refresh error (attempt ${consecutiveFailures}):`, error);
      scheduleBackoffReset();
    } finally {
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
export const forceJwtRefresh = async (supabase: TypedSupabase): Promise<void> => {
  await refreshSession(supabase);
  // Removed problematic force_jwt_refresh call
};