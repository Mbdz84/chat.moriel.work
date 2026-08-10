"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useCallerId, type CallerIdEntry } from "@/lib/callerId";
import TwilioSettings from "@/components/TwilioSettings";
import NotificationsSettings from "@/components/NotificationsSettings";

// Settings sub-tabs. Add more entries here as features grow.
const SETTINGS_TABS = [
  { key: "numbers", label: "Numbers" },
  { key: "caller-id", label: "Caller ID" },
  { key: "notifications", label: "Notifications" },
] as const;

type TabKey = (typeof SETTINGS_TABS)[number]["key"];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("numbers");

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your workspace.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
          {SETTINGS_TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 h-9 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  on
                    ? "border-brand-600 text-brand-700 dark:text-brand-300"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "numbers" && <TwilioSettings />}
        {tab === "caller-id" && <CallerIdManager />}
        {tab === "notifications" && <NotificationsSettings />}
      </div>
    </div>
  );
}

function CallerIdManager() {
  const { entries, addEntry, updateEntry, removeEntry } = useCallerId();
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!number.trim() || !name.trim()) return;
    if (editingId) {
      updateEntry(editingId, number, name);
      setEditingId(null);
    } else {
      addEntry(number, name);
    }
    setNumber("");
    setName("");
  }

  function edit(entry: CallerIdEntry) {
    setEditingId(entry.id);
    setNumber(entry.number);
    setName(entry.name);
  }

  function cancel() {
    setEditingId(null);
    setNumber("");
    setName("");
  }

  return (
    <Section title="Saved names">
      <p className="px-4 pt-3 text-xs text-slate-400">
        Save a name for a number. It shows up as a chip in the chat header and
        can be used as the conversation title.
      </p>
      <form onSubmit={submit} className="px-4 py-3 flex flex-col sm:flex-row gap-2">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Number, e.g. (219) 402-7666"
          className="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
          >
            {editingId ? "Save" : "Add"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancel}
              className="h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">
          No saved names yet. Add one above.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{e.name}</div>
                <div className="text-xs text-slate-400">
                  {formatNumber(e.number)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => edit(e)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Edit"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
                <button
                  onClick={() => removeEntry(e.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  title="Delete"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 first:border-t-0">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
