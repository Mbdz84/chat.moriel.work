"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompany } from "@/lib/company";

type Company = {
  id: string;
  code: string;
  name: string;
  members: number;
  disabled: boolean;
};

export default function AdminPage() {
  const { reload: reloadSwitcher } = useCompany();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const loadCompanies = useCallback(async () => {
    const res = await fetch("/api/admin/companies");
    if (res.ok) {
      const d = (await res.json()) as { companies: Company[] };
      setCompanies(d.companies);
    }
    // Also refresh the top-bar company switcher (memberships may have changed).
    reloadSwitcher();
  }, [reloadSwitcher]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/context");
      const d = (await res.json()) as { isSuperadmin: boolean };
      setAllowed(d.isSuperadmin);
      if (d.isSuperadmin) loadCompanies();
    })();
  }, [loadCompanies]);

  if (allowed === null) {
    return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          This area is for platform administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Platform admin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create companies and users across all tenants.
          </p>
        </div>

        <CreateCompany onCreated={loadCompanies} />
        <CreateUser companies={companies} onCreated={loadCompanies} />
        <CompaniesList companies={companies} onChange={loadCompanies} />
      </div>
    </div>
  );
}

function CreateCompany({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code }),
    });
    setBusy(false);
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMsg(d.error ?? "Failed.");
      return;
    }
    setMsg(`Created "${name}".`);
    setName("");
    setCode("");
    onCreated();
  }

  return (
    <Section title="Create company">
      <form onSubmit={submit} className="p-4 flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company name"
          className={inputCls}
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Login code (e.g. 12345)"
          className={inputCls}
        />
        <button type="submit" disabled={busy} className={btnCls}>
          {busy ? "…" : "Create"}
        </button>
      </form>
      {msg && <p className="px-4 pb-3 text-sm text-slate-500">{msg}</p>}
    </Section>
  );
}

function CreateUser({
  companies,
  onCreated,
}: {
  companies: Company[];
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) {
      setMsg("Pick a company.");
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username, companyId, role }),
    });
    setBusy(false);
    const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) {
      setMsg(d.error ?? "Failed.");
      return;
    }
    setMsg(d.message ?? "Done.");
    setEmail("");
    setPassword("");
    setUsername("");
    onCreated();
  }

  return (
    <Section title="Create user">
      <form onSubmit={submit} className="p-4 space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={`${inputCls} w-full`}
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temp password (new users)"
            className={inputCls}
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Display name (optional)"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
            className={inputCls}
          >
            <option value="viewer">Viewer (chat only)</option>
            <option value="admin">Admin (full access)</option>
          </select>
          <button type="submit" disabled={busy} className={btnCls}>
            {busy ? "…" : "Create"}
          </button>
        </div>
      </form>
      {msg && <p className="px-4 pb-3 text-sm text-slate-500">{msg}</p>}
    </Section>
  );
}

function CompaniesList({
  companies,
  onChange,
}: {
  companies: Company[];
  onChange: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function toggleDisabled(c: Company) {
    setBusyId(c.id);
    await fetch(`/api/admin/companies/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !c.disabled }),
    });
    setBusyId(null);
    onChange();
  }

  async function remove(c: Company) {
    setBusyId(c.id);
    await fetch(`/api/admin/companies/${c.id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmId(null);
    onChange();
  }

  return (
    <Section title="Companies">
      {companies.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">No companies yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {companies.map((c) => (
            <div key={c.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span className="truncate">{c.name}</span>
                    {c.disabled && (
                      <span className="text-[11px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-500/15 rounded-full px-2 py-0.5">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    Code {c.code} · {c.members} {c.members === 1 ? "member" : "members"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {expandedId === c.id ? "Hide users" : "Users"}
                  </button>
                  <button
                    onClick={() => toggleDisabled(c)}
                    disabled={busyId === c.id}
                    className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
                  >
                    {c.disabled ? "Enable" : "Disable"}
                  </button>
                  <button
                    onClick={() => setConfirmId(c.id)}
                    disabled={busyId === c.id}
                    className="h-8 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === c.id && <MembersPanel companyId={c.id} onChange={onChange} />}

              {confirmId === c.id && (
                <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3">
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Permanently delete <strong>{c.name}</strong> and all its
                    numbers, contacts and messages? This cannot be undone.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => remove(c)}
                      disabled={busyId === c.id}
                      className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-60"
                    >
                      {busyId === c.id ? "Deleting…" : "Delete permanently"}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

type Member = {
  userId: string;
  username: string | null;
  role: "admin" | "viewer";
  email: string;
  disabled: boolean;
  isSelf: boolean;
};

function MembersPanel({
  companyId,
  onChange,
}: {
  companyId: string;
  onChange: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [pwId, setPwId] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [nameId, setNameId] = useState<string | null>(null);
  const [nameVal, setNameVal] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?companyId=${companyId}`);
    if (res.ok) {
      const d = (await res.json()) as { members: Member[] };
      setMembers(d.members);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(userId: string, body: Record<string, unknown>) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, userId, ...body }),
    });
    await load();
    onChange();
  }
  async function setPassword(userId: string) {
    setNote("");
    const res = await fetch("/api/admin/users/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password: pw }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setNote(res.ok ? "Password updated." : d.error ?? "Failed.");
    if (res.ok) {
      setPwId(null);
      setPw("");
    }
  }
  async function toggleDisabled(m: Member) {
    await patch(m.userId, { disabled: !m.disabled });
  }
  async function removeMember(userId: string) {
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, userId }),
    });
    setConfirmId(null);
    await load();
    onChange();
  }

  if (loading) return <p className="mt-2 text-xs text-slate-400">Loading users…</p>;

  return (
    <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
      {members.length === 0 && (
        <p className="px-3 py-4 text-xs text-slate-400 text-center">No users.</p>
      )}
      {members.map((m) => (
        <div key={m.userId} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              {nameId === m.userId ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameVal}
                    onChange={(e) => setNameVal(e.target.value)}
                    autoFocus
                    placeholder="Name"
                    className="h-7 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs"
                  />
                  <button
                    onClick={() => {
                      patch(m.userId, { username: nameVal });
                      setNameId(null);
                    }}
                    className="h-7 px-2 rounded-md bg-brand-600 text-white text-xs"
                  >
                    Save
                  </button>
                  <button onClick={() => setNameId(null)} className="h-7 px-2 rounded-md border border-slate-300 dark:border-slate-700 text-xs">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {m.username || m.email}
                  {m.isSelf && <span className="text-xs text-slate-400">(you)</span>}
                  {m.disabled && (
                    <span className="text-[11px] text-amber-600 bg-amber-100 dark:bg-amber-500/15 rounded-full px-2 py-0.5">
                      Disabled
                    </span>
                  )}
                </div>
              )}
              <div className="text-xs text-slate-400 truncate">{m.email}</div>
            </div>
            <select
              value={m.role}
              onChange={(e) => patch(m.userId, { role: e.target.value })}
              disabled={m.isSelf}
              className="h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs disabled:opacity-60 shrink-0"
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { setNameId(m.userId); setNameVal(m.username ?? ""); }} className={smallBtn}>
              Edit name
            </button>
            <button onClick={() => { setPwId(pwId === m.userId ? null : m.userId); setPw(""); setNote(""); }} className={smallBtn}>
              Change password
            </button>
            {!m.isSelf && (
              <button onClick={() => toggleDisabled(m)} className={smallBtn}>
                {m.disabled ? "Enable" : "Disable"}
              </button>
            )}
            {!m.isSelf && (
              <button onClick={() => setConfirmId(m.userId)} className="h-7 px-2.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                Remove
              </button>
            )}
          </div>

          {pwId === m.userId && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="New password (min 6)"
                className="h-8 flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs"
              />
              <button onClick={() => setPassword(m.userId)} className="h-8 px-3 rounded-md bg-brand-600 text-white text-xs font-medium">
                Set
              </button>
            </div>
          )}
          {pwId === m.userId && note && <p className="text-xs text-slate-500">{note}</p>}

          {confirmId === m.userId && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Remove {m.email} from this company?</span>
              <button onClick={() => removeMember(m.userId)} className="h-7 px-2.5 rounded-md bg-red-600 text-white text-xs font-medium">
                Remove
              </button>
              <button onClick={() => setConfirmId(null)} className="h-7 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs">
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const smallBtn =
  "h-7 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800";

const inputCls =
  "flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";
const btnCls =
  "h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors disabled:opacity-60 shrink-0";

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
