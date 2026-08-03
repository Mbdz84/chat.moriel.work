"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!company || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Confirm this account belongs to the entered company code.
    // RLS only returns the company if the user is a member of it.
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("code", company.trim())
      .maybeSingle();

    if (!comp) {
      setError("You don't have access to that company code.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    try {
      localStorage.setItem("activeCompanyId", comp.id);
    } catch {}

    // Full navigation so middleware picks up the fresh session cookie.
    router.push("/chat");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100 dark:bg-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-600/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-soft">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z" />
            </svg>
          </span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            Chat Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to your workspace
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Company code"
              value={company}
              onChange={setCompany}
              placeholder="e.g. 01222"
              autoFocus
            />
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              type="email"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-5">
          Need access? Contact your workspace admin.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 placeholder:text-slate-400"
      />
    </label>
  );
}
