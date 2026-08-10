"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/format";

type NumberRow = {
  id: string;
  phone_number: string;
  label: string | null;
};

type Data = {
  isAdmin: boolean;
  accountSid: string;
  hasToken: boolean;
  inboundUrl: string;
  numbers: NumberRow[];
  balance: string | null;
  currency: string | null;
};

function money(balance: string | null, currency: string | null): string | null {
  if (!balance) return null;
  const n = parseFloat(balance);
  if (Number.isNaN(n)) return null;
  return currency === "USD" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${currency ?? ""}`.trim();
}

export default function TwilioSettings() {
  const { active } = useCompany();
  const companyId = active?.companyId ?? null;

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsMsg, setCredsMsg] = useState("");

  const [newNumber, setNewNumber] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [copied, setCopied] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const res = await fetch(`/api/settings/twilio?companyId=${companyId}`);
    const d = (await res.json()) as Data;
    setData(d);
    setSid(d.accountSid ?? "");
    setToken("");
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCreds(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setSavingCreds(true);
    setCredsMsg("");
    const res = await fetch("/api/settings/twilio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, accountSid: sid, authToken: token }),
    });
    setSavingCreds(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setCredsMsg(j.error ?? "Failed to save.");
      return;
    }
    setCredsMsg("Saved.");
    await load();
  }

  async function pullNumbers() {
    if (!companyId) return;
    setPulling(true);
    setPullMsg("");
    const res = await fetch("/api/settings/twilio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, action: "import" }),
    });
    setPulling(false);
    const j = (await res.json().catch(() => ({}))) as { imported?: number; error?: string };
    if (!res.ok) {
      setPullMsg(j.error ?? "Couldn't reach Twilio.");
      return;
    }
    setPullMsg(
      j.imported
        ? `Added ${j.imported} new number${j.imported === 1 ? "" : "s"}.`
        : "No new numbers pointing at this app."
    );
    await load();
  }

  async function addNumber(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !newNumber.trim()) return;
    const s = createClient();
    await s.from("numbers").insert({
      company_id: companyId,
      phone_number: newNumber.trim(),
      label: newLabel.trim() || null,
    });
    setNewNumber("");
    setNewLabel("");
    await load();
  }

  async function removeNumber(id: string) {
    const s = createClient();
    await s.from("numbers").delete().eq("id", id);
    await load();
  }

  async function saveLabel(id: string) {
    const s = createClient();
    await s.from("numbers").update({ label: editLabel.trim() || null }).eq("id", id);
    setEditId(null);
    setEditLabel("");
    await load();
  }

  function copyUrl() {
    if (!data) return;
    navigator.clipboard.writeText(data.inboundUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading || !data) {
    return <p className="text-sm text-slate-400 py-6">Loading…</p>;
  }

  const admin = data.isAdmin;
  const credsReady = Boolean(data.accountSid && data.hasToken);

  return (
    <div className="space-y-5">
      {/* Twilio credentials */}
      <Section title="Twilio account">
        <form onSubmit={saveCreds} className="p-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Account SID</span>
            <input
              value={sid}
              onChange={(e) => setSid(e.target.value)}
              disabled={!admin}
              placeholder="ACxxxxxxxxxxxxxxxx"
              className="mt-1 w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Auth token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={!admin}
              placeholder={data.hasToken ? "•••••••• (saved — leave blank to keep)" : "your auth token"}
              className="mt-1 w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
            />
          </label>
          <div className="flex items-center gap-3">
            {admin && (
              <button
                type="submit"
                disabled={savingCreds}
                className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {savingCreds ? "Saving…" : "Save"}
              </button>
            )}
            <span className="text-sm">
              {credsReady ? (
                <span className="text-emerald-600">
                  ● Connected
                  {money(data.balance, data.currency) && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}· Balance {money(data.balance, data.currency)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-slate-400">Not configured</span>
              )}
            </span>
            {credsMsg && <span className="text-sm text-slate-500">{credsMsg}</span>}
          </div>
        </form>
      </Section>

      {/* Webhook URL */}
      <Section title="Inbound webhook">
        <div className="p-4 space-y-2">
          <p className="text-xs text-slate-400">
            In the Twilio Console, set this as each number&apos;s “A message comes in” webhook (HTTP POST):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">
              {data.inboundUrl}
            </code>
            <button
              onClick={copyUrl}
              className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </Section>

      {/* Numbers */}
      <Section title="Your numbers">
        {admin && (
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400">
              Pull numbers whose Twilio webhook already points at this app.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {pullMsg && <span className="text-xs text-slate-500">{pullMsg}</span>}
              <button
                onClick={pullNumbers}
                disabled={pulling || !credsReady}
                title={!credsReady ? "Save your Twilio credentials first" : undefined}
                className="h-9 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {pulling ? "Checking…" : "Check Twilio for new numbers"}
              </button>
            </div>
          </div>
        )}

        {admin && (
          <form onSubmit={addNumber} className="p-4 flex flex-col sm:flex-row gap-2 border-b border-slate-100 dark:border-slate-800">
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="+13125551234"
              className="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              className="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Add manually
            </button>
          </form>
        )}

        {data.numbers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">
            No numbers yet. Use “Check Twilio for new numbers” or add one manually.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.numbers.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{formatNumber(n.phone_number)}</div>
                  {editId === n.id ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        autoFocus
                        placeholder="Label"
                        className="h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm outline-none focus:border-brand-500"
                      />
                      <button
                        onClick={() => saveLabel(n.id)}
                        className="h-8 px-2.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="h-8 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">{n.label || "No label"}</div>
                  )}
                </div>
                {admin && editId !== n.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditId(n.id);
                        setEditLabel(n.label ?? "");
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit label"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeNumber(n.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      title="Remove"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
