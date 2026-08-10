"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import FontSizeControl from "./FontSizeControl";
import CompanySwitcher from "./CompanySwitcher";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const ADMIN_TAB: Tab = {
  href: "/admin",
  label: "Admin",
  icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
};

// Add future features here — the bar grows automatically.
const TABS: Tab[] = [
  {
    href: "/chat",
    label: "Chat",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const { active } = useCompany();
  const companyId = active?.companyId ?? null;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch("/api/admin/context")
      .then((r) => r.json())
      .then((d: { isSuperadmin?: boolean }) => setIsSuperadmin(Boolean(d.isSuperadmin)))
      .catch(() => {});
  }, []);

  // Live unread count (inbox conversations) for the Chat tab badge.
  useEffect(() => {
    if (!companyId) {
      setUnread(0);
      return;
    }
    const s = createClient();
    const load = async () => {
      const { count } = await s
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "inbox")
        .gt("unread", 0);
      setUnread(count ?? 0);
    };
    load();
    const ch = s
      .channel(`unread-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `company_id=eq.${companyId}` },
        () => load()
      )
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [companyId]);

  const tabs = isSuperadmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <header className="relative z-30 h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 sm:px-4 flex items-center gap-1.5 sm:gap-4">
      {/* Logo */}
      <Link href="/chat" className="flex items-center gap-2 shrink-0">
        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-soft">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z" />
          </svg>
        </span>
        <span className="font-semibold tracking-tight hidden sm:block">
          Chat Console
        </span>
      </Link>

      {/* Company switcher */}
      <div className="min-w-0 pl-0.5 sm:pl-2 sm:border-l border-slate-200 dark:border-slate-800">
        <CompanySwitcher />
      </div>

      {/* Tabs */}
      <nav className="flex items-center gap-0.5 sm:gap-1 ml-0.5 sm:ml-2 shrink-0">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative flex items-center gap-2 px-2 sm:px-3 h-9 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
            >
              <span className="relative">
                {t.icon}
                {t.href === "/chat" && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </span>
              <span className="hidden sm:block">{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right controls */}
      <div className="ml-auto shrink-0 flex items-center gap-0.5 sm:gap-2">
        <div className="hidden sm:block">
          <FontSizeControl />
        </div>
        <ThemeToggle />
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/");
            router.refresh();
          }}
          className="flex items-center gap-2 px-2 sm:px-3 h-9 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
          title="Sign out"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  );
}
