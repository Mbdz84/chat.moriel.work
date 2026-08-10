"use client";

import { useEffect, useRef, useState } from "react";
import { useCompany } from "@/lib/company";

export default function CompanySwitcher() {
  const { companies, active, setActive, loading } = useCompany();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (loading || !active) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 px-2 sm:px-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors max-w-[110px] sm:max-w-[200px]"
        title="Switch company"
      >
        <span className="w-6 h-6 rounded-md bg-brand-600 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
          {active.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate">{active.name}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-60 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-1 z-50">
          <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400">
            Companies
          </p>
          {companies.map((c) => {
            const on = c.companyId === active.companyId;
            return (
              <button
                key={c.companyId}
                onClick={() => {
                  setActive(c.companyId);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  on
                    ? "bg-brand-50 dark:bg-brand-600/15"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="w-6 h-6 rounded-md bg-brand-600 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block text-xs text-slate-400">
                    Code {c.code} · {c.role}
                  </span>
                </span>
                {on && (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600 shrink-0">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
