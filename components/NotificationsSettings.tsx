"use client";

import { useEffect, useState } from "react";
import {
  pushSupported,
  permissionState,
  currentSubscription,
  enablePush,
  disablePush,
} from "@/lib/push";

export default function NotificationsSettings() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<string>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ok = pushSupported();
      setSupported(ok);
      if (!ok) return;
      setPermission(permissionState());
      const sub = await currentSubscription();
      setEnabled(Boolean(sub));
    })();
  }, []);

  const [testMsg, setTestMsg] = useState("");
  async function sendTest() {
    setTestMsg("Sending…");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const txt = await res.text();
      let d: { subscriptions?: number; vapidConfigured?: boolean; error?: string; raw?: string } = {};
      try {
        d = JSON.parse(txt);
      } catch {
        d = { raw: txt };
      }
      if (!res.ok) {
        setTestMsg(`Failed (${res.status}): ${d.error || d.raw || "unknown error"}`);
        return;
      }
      if (!d.vapidConfigured) {
        setTestMsg("Server is missing VAPID keys — add them in Vercel and redeploy.");
      } else if (!d.subscriptions) {
        setTestMsg("No subscription saved on this device — turn notifications off and on again.");
      } else {
        setTestMsg(`Sent to ${d.subscriptions} device(s). If nothing appears, check the Android app's notification permission.`);
      }
    } catch (e) {
      setTestMsg(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush();
        setEnabled(true);
        setPermission("granted");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Push notifications</h2>
      </div>
      <div className="p-4 space-y-3">
        {!supported ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This browser doesn&apos;t support push notifications. On iPhone, open
            this site in Safari, tap Share → <strong>Add to Home Screen</strong>,
            then enable notifications from the installed app.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Alerts for new incoming messages
                </p>
                <p className="text-xs text-slate-400">
                  {enabled
                    ? "On for this device."
                    : "Off. Turn on to get notified even when the app is closed."}
                </p>
              </div>
              <button
                onClick={toggle}
                disabled={busy || permission === "denied"}
                className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                  enabled
                    ? "border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    : "bg-brand-600 hover:bg-brand-700 text-white"
                }`}
              >
                {busy ? "…" : enabled ? "Turn off" : "Enable"}
              </button>
            </div>

            {enabled && (
              <div className="flex items-center gap-3">
                <button
                  onClick={sendTest}
                  className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Send test notification
                </button>
                {testMsg && <span className="text-xs text-slate-500">{testMsg}</span>}
              </div>
            )}

            {permission === "denied" && (
              <p className="text-xs text-amber-600">
                Notifications are blocked in your browser settings for this site.
                Allow them there, then reload.
              </p>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <p className="text-xs text-slate-400">
              Notifications are per device — enable it on each phone or computer
              you want alerts on. Muted conversations won&apos;t notify.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
