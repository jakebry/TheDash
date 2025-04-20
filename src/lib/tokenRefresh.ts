import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Update if needed

type TypedSupabase = SupabaseClient<Database>;

let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 60000; // 60s minimum between refreshes
const BACKOFF_RESET_DELAY = 300000; // reset backoff after 5 mins

let consecutiveFailures = 0;
let backoffTimeout: NodeJS.Timeout | null = null;
let refreshPromise: Promise<void> | null = null;

const getBackoffDelay = (): number => {
  if (consecutiveFailures === 0) return 0;
  return Math.min(Math.pow(2, consecutiveFailures) * 1000, 60000);
};

const resetBackoff = () => {
  consecutiveFailures = 0;
  if (backoffTimeout) {
    clearTimeout(backoffTimeout);
    backoffTimeout = null;
  }
};

const scheduleBackoffReset = () => {
  if (backoffTimeout) clearTimeout(backoffTimeout);
  backoffTimeout = setTimeout(resetBackoff, BACKOFF_RESET_DELAY);
};

export const refreshSession = async (supabase: TypedSupabase): Promise<void> => {
  const now = Date.now();
  const timeSinceLastRefresh = now - lastRefreshTime;

  if (refreshPromise) return refreshPromise;

  if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
    console.info("⏱ Skipping refresh - too soon");
    return;
  }

  const delay = getBackoffDelay();
  if (delay > 0) {
    console.warn(`⚠️ Delaying refresh due to backoff: ${delay}ms`);
    await new Promise((res) => setTimeout(res, delay));
  }

  refreshPromise = supabase.auth.refreshSession()
    .then(({ error }) => {
      if (error) {
        console.error("❌ Session refresh failed:", error.message);
        consecutiveFailures++;
        scheduleBackoffReset();
      } else {
        console.info("✅ Session refreshed");
        lastRefreshTime = Date.now();
        resetBackoff();
      }
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};
