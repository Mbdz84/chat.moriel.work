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
  const [menuOpen, setMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [username, setUsername] = useState<string | null>(null);

  // Current signed-in user's email (always available).
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserEmail(data.user?.email ?? ""))
      .catch(() => {});
  }, []);

  // Per-company username (if the membership has one) for the active company.
  useEffect(() => {
    if (!companyId) {
      setUsername(null);
      return;
    }
    const s = createClient();
    (async () => {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) return;
      const { data } = await s
        .from("memberships")
        .select("username")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .maybeSingle();
      setUsername(((data?.username as string | null) ?? null) || null);
    })();
  }, [companyId]);

  const displayName = username || userEmail || "";
  const initial = (displayName.trim()[0] || "?").toUpperCase();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

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
    // Recount instantly when the chat view marks something read/unread in this
    // same tab (realtime alone can lag or miss the conversations update).
    const onLocal = () => load();
    window.addEventListener("chat:unread", onLocal);
    const ch = s
      .channel(`unread-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `company_id=eq.${companyId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `company_id=eq.${companyId}` },
        () => load()
      )
      .subscribe();
    return () => {
      window.removeEventListener("chat:unread", onLocal);
      s.removeChannel(ch);
    };
  }, [companyId]);

  const tabs = isSuperadmin ? [...TABS, ADMIN_TAB] : TABS;

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  const signOutIcon = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );

  const logo = (
    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-soft shrink-0">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
        <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z" />
      </svg>
    </span>
  );

  const avatar = (
    <span className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-600/25 dark:text-brand-300 text-xs font-semibold flex items-center justify-center shrink-0">
      {initial}
    </span>
  );

  return (
    <>
      {/* ===== Desktop top bar (md and up) ===== */}
      <header className="relative z-30 h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 sm:px-4 hidden md:flex items-center gap-1.5 sm:gap-4">
        {/* Logo */}
        <Link href="/chat" className="flex items-center gap-2 shrink-0">
          {logo}
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
          {displayName && (
            <div
              className="flex items-center gap-2 pl-1 shrink-0 text-slate-600 dark:text-slate-300"
              title={displayName}
            >
              {avatar}
              <span className="text-sm font-medium whitespace-nowrap">{displayName}</span>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-2 sm:px-3 h-9 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            title="Sign out"
          >
            {signOutIcon}
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </header>

      {/* ===== Mobile slim bar (below md) ===== */}
      <header className="relative z-30 h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 flex md:hidden items-center gap-2">
        <button
          onClick={() => setMenuOpen(true)}
          className="relative w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white active:scale-90 transition-transform"
          title="Menu"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
        <Link
          href="/chat"
          onClick={() => {
            // Already on /chat with a conversation open? The route won't change,
            // so tell the chat page to pop back to the contact list.
            try {
              window.dispatchEvent(new Event("chat:home"));
            } catch {}
          }}
          className="flex items-center gap-2 min-w-0"
        >
          <span className="font-semibold tracking-tight truncate">Chat Console</span>
        </Link>
        <div className="ml-auto shrink-0">
          <ThemeToggle />
        </div>
      </header>

      {/* ===== Mobile slide-out drawer (below md) ===== */}
      <div className={`md:hidden ${menuOpen ? "" : "pointer-events-none"}`}>
        {/* Backdrop */}
        <div
          onClick={() => setMenuOpen(false)}
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Panel */}
        <aside
          className={`fixed left-0 top-0 z-50 h-full w-72 max-w-[82%] bg-white dark:bg-slate-900 shadow-xl flex flex-col transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Drawer header */}
          <div className="h-14 shrink-0 px-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <Link
              href="/chat"
              onClick={() => {
                setMenuOpen(false);
                try {
                  window.dispatchEvent(new Event("chat:home"));
                } catch {}
              }}
              className="flex items-center gap-2 min-w-0"
            >
              {logo}
              <span className="font-semibold tracking-tight truncate">Chat Console</span>
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white active:scale-90 transition-transform"
              aria-label="Close menu"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Company switcher */}
          <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-800">
            <CompanySwitcher />
          </div>

          {/* Nav */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3 flex flex-col gap-1">
            {tabs.map((t) => {
              const active = pathname === t.href || pathname.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={() => setMenuOpen(false)}
                  className={`relative flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <span className="shrink-0">{t.icon}</span>
                  <span>{t.label}</span>
                  {t.href === "/chat" && unread > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer controls */}
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-3 py-3 flex flex-col gap-2">
            {displayName && (
              <div className="flex items-center gap-2 px-1 pb-1 min-w-0" title={displayName}>
                {avatar}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {displayName}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-slate-400">Text size</span>
              <FontSizeControl />
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            >
              {signOutIcon}
              <span>Sign out</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
