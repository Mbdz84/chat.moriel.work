"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensurePushSubscribed } from "@/lib/push";

/**
 * Keeps the session and push subscription healthy for the life of the app.
 *
 *  - Session: the Supabase browser client auto-refreshes the access token while
 *    the tab is open, but timers are throttled/paused when the app is in the
 *    background (very common on a phone home-screen PWA). On every return to the
 *    foreground we nudge Supabase to refresh, so the user stays logged in
 *    instead of coming back to an expired session.
 *  - Push: we re-register the service worker and (if already permitted) re-sync
 *    the subscription, so notifications self-heal after the browser rotates or
 *    drops a subscription.
 */
export default function AppKeeper() {
  useEffect(() => {
    const supabase = createClient();

    const refresh = () => {
      // Touching the session makes the client refresh the token if it's near
      // or past expiry. Failures are non-fatal (e.g. offline) — the next
      // foreground event tries again.
      supabase.auth.getSession().catch(() => {});
      ensurePushSubscribed().catch(() => {});
    };

    refresh();
    // Keep the auto-refresh timer running/paused with visibility.
    supabase.auth.startAutoRefresh?.();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", refresh);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, []);

  return null;
}
