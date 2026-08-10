"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/client";
import CompanyUsers from "./CompanyUsers";

export default function CompanySettings() {
  const { active, isAdmin, reload } = useCompany();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setName(active?.name ?? "");
  }, [active?.name]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !name.trim()) return;
    setSaving(true);
    setMsg("");
    const s = createClient();
    const { error } = await s
      .from("companies")
      .update({ name: name.trim() })
      .eq("id", active.companyId);
    setSaving(false);
    if (error) {
      setMsg("Couldn't save — check you have admin access.");
      return;
    }
    setMsg("Saved.");
    await reload();
  }

  function copyCode() {
    if (!active) return;
    navigator.clipboard.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!active) {
    return <p className="text-sm text-slate-400 py-6">No company selected.</p>;
  }

  return (
    <div className="space-y-5">
      <Section title="Company name">
        <form onSubmit={save} className="p-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            placeholder="Company name"
            className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
          />
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
            {!isAdmin && (
              <span className="text-sm text-slate-400">View-only access.</span>
            )}
          </div>
        </form>
      </Section>

      <Section title="Login code">
        <div className="p-4 space-y-2">
          <p className="text-xs text-slate-400">
            Members enter this code on the sign-in screen to reach this company.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-base font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 tracking-wide">
              {active.code}
            </code>
            <button
              onClick={copyCode}
              className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Your role: <span className="font-medium">{active.role}</span>
          </p>
        </div>
      </Section>

      {isAdmin && <CompanyUsers />}
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
