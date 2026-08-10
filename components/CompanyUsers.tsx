"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompany } from "@/lib/company";

type Member = {
  userId: string;
  username: string | null;
  role: "admin" | "viewer";
  email: string;
  disabled: boolean;
  isSelf: boolean;
};

export default function CompanyUsers() {
  const { active } = useCompany();
  const companyId = active?.companyId ?? null;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const res = await fetch(`/api/company/users?companyId=${companyId}`);
    if (res.ok) {
      const d = (await res.json()) as { members: Member[] };
      setMembers(d.members);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !email.trim()) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/company/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, email, password, username, role }),
    });
    setBusy(false);
    const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) {
      setMsg(d.error ?? "Failed.");
      return;
    }
    setMsg(d.message ?? "Added.");
    setEmail("");
    setPassword("");
    setUsername("");
    await load();
  }

  async function changeRole(userId: string, next: "admin" | "viewer") {
    if (!companyId) return;
    await fetch("/api/company/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, userId, role: next }),
    });
    await load();
  }

  async function toggleDisabled(m: Member) {
    if (!companyId) return;
    await fetch("/api/company/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, userId: m.userId, disabled: !m.disabled }),
    });
    await load();
  }

  async function remove(userId: string) {
    if (!companyId) return;
    await fetch("/api/company/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, userId }),
    });
    setConfirmId(null);
    await load();
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Users</h2>
      </div>

      {/* Add user */}
      <form onSubmit={addUser} className="p-4 space-y-2 border-b border-slate-100 dark:border-slate-800">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={inputCls + " w-full"}
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temp password (new users)"
            className={inputCls}
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Name (optional)"
            className={inputCls}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
            className={inputCls}
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={busy} className={btnCls}>
            {busy ? "…" : "Add"}
          </button>
        </div>
        {msg && <p className="text-sm text-slate-500">{msg}</p>}
      </form>

      {/* Member list */}
      {loading ? (
        <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>
      ) : members.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">No users yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((m) => (
            <div key={m.userId} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    <span className="truncate">{m.username || m.email}</span>
                    {m.isSelf && <span className="text-xs text-slate-400">(you)</span>}
                    {m.disabled && (
                      <span className="text-[11px] text-amber-600 bg-amber-100 dark:bg-amber-500/15 rounded-full px-2 py-0.5">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{m.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.userId, e.target.value as "admin" | "viewer")}
                    disabled={m.isSelf}
                    className="h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs disabled:opacity-60"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  {!m.isSelf && (
                    <button
                      onClick={() => toggleDisabled(m)}
                      className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {m.disabled ? "Enable" : "Disable"}
                    </button>
                  )}
                  {!m.isSelf && (
                    <button
                      onClick={() => setConfirmId(m.userId)}
                      className="h-8 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {confirmId === m.userId && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Remove {m.email} from this company?</span>
                  <button
                    onClick={() => remove(m.userId)}
                    className="h-7 px-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="h-7 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const inputCls =
  "flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";
const btnCls =
  "h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors disabled:opacity-60 shrink-0";
