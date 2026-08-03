"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  contacts as seedContacts,
  type Contact,
  type Message,
  type ConvoStatus,
} from "@/lib/mockData";
import {
  timeShort,
  listStamp,
  dayLabel,
  initials,
  formatNumber,
  normalizeNumber,
} from "@/lib/format";
import { useCallerId } from "@/lib/callerId";

const TABS: { key: ConvoStatus; label: string; icon: React.ReactNode }[] = [
  {
    key: "inbox",
    label: "Inbox",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
      </svg>
    ),
  },
  {
    key: "blocked",
    label: "Blocked",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="m4.9 4.9 14.2 14.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "archived",
    label: "Archive",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
      </svg>
    ),
  },
];

type DisplayMode = "name" | "number";

export default function ChatPage() {
  const { nameFor } = useCallerId();
  const [contacts, setContacts] = useState<Contact[]>(seedContacts);
  const [tab, setTab] = useState<ConvoStatus>("inbox");
  const [activeId, setActiveId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [listWidth, setListWidth] = useState(360);
  const [isDesktop, setIsDesktop] = useState(false);
  // Per-conversation choice of showing name vs number, keyed by number.
  const [convoModes, setConvoModes] = useState<Record<string, DisplayMode>>({});
  const draggingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Effective display mode for one conversation: explicit choice, else
  // default to name when a Caller ID exists, otherwise number.
  function modeFor(c: Contact): DisplayMode {
    const explicit = convoModes[normalizeNumber(c.number)];
    if (explicit) return explicit;
    return nameFor(c.number) ? "name" : "number";
  }
  function setMode(c: Contact, mode: DisplayMode) {
    setConvoModes((prev) => {
      const next = { ...prev, [normalizeNumber(c.number)]: mode };
      try {
        localStorage.setItem("convoModes", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // Title shown for a conversation.
  function titleFor(c: Contact): string {
    const name = nameFor(c.number);
    if (modeFor(c) === "name" && name) return name;
    return formatNumber(c.number);
  }
  // The "other" label (subtitle), if there is one.
  function subFor(c: Contact): string | null {
    const name = nameFor(c.number);
    if (modeFor(c) === "name") return name ? formatNumber(c.number) : null;
    return name ?? null; // showing number as title -> subtitle is the name
  }

  // Per-tab totals and unread (unopened) conversation counts.
  const tabStats = useMemo(() => {
    const blank = () => ({ total: 0, unread: 0 });
    const s: Record<ConvoStatus, { total: number; unread: number }> = {
      inbox: blank(),
      blocked: blank(),
      archived: blank(),
    };
    contacts.forEach((c) => {
      s[c.status].total += 1;
      if (c.unread > 0) s[c.status].unread += 1;
    });
    return s;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = contacts
      .filter((c) => c.status === tab)
      .map((c) => ({ c, last: c.messages[c.messages.length - 1] }));
    rows.sort(
      (a, b) =>
        new Date(b.last?.timestamp ?? 0).getTime() -
        new Date(a.last?.timestamp ?? 0).getTime()
    );
    if (!q) return rows;
    return rows.filter(({ c }) => {
      const name = nameFor(c.number)?.toLowerCase() ?? "";
      return c.number.includes(q) || name.includes(q);
    });
  }, [contacts, tab, search, nameFor]);

  const active = contacts.find((c) => c.id === activeId) ?? null;
  // Keep labels as long as possible: drop the count badges first, then, only
  // when really narrow, collapse to icons-only. Mobile (full width) always
  // shows full labels + counts.
  // Tabs always show their text labels on desktop; the panel can't shrink
  // below a width that keeps all three readable.
  const iconsOnly = false;

  // Keep a valid active conversation when the tab / list changes.
  useEffect(() => {
    if (!active || active.status !== tab) {
      setActiveId(filtered[0]?.c.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, contacts]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, active?.messages.length]);

  // Desktop breakpoint + saved list width.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    try {
      const saved = localStorage.getItem("listWidth");
      if (saved) setListWidth(clampWidth(parseInt(saved, 10)));
      const modes = localStorage.getItem("convoModes");
      if (modes) setConvoModes(JSON.parse(modes));
    } catch {}
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    try {
      localStorage.setItem("listWidth", String(listWidth));
    } catch {}
  }, [listWidth, isDesktop]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      if (draggingRef.current) setListWidth(clampWidth(ev.clientX));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function openContact(id: string) {
    setActiveId(id);
    setMobilePane("chat");
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  }

  function send() {
    const body = draft.trim();
    if (!body || !active) return;
    const msg: Message = {
      id: `local-${Date.now()}`,
      body,
      direction: "out",
      timestamp: new Date().toISOString(),
      status: "sent",
    };
    setContacts((prev) =>
      prev.map((c) =>
        c.id === active.id ? { ...c, messages: [...c.messages, msg] } : c
      )
    );
    setDraft("");
  }

  function setStatus(id: string, status: ConvoStatus) {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
    setMobilePane("list");
  }
  function toggleMute(id: string) {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, muted: !c.muted } : c))
    );
  }
  function remove(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setMobilePane("list");
  }

  const activeName = active ? nameFor(active.number) : undefined;

  return (
    <div className="h-full p-2 sm:p-3 md:p-4">
      <div className="h-full flex rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft overflow-hidden">
        {/* LEFT: conversation list */}
        <aside
          style={isDesktop ? { width: listWidth } : undefined}
          className={`${
            mobilePane === "chat" ? "hidden" : "flex"
          } md:flex w-full shrink-0 flex-col border-r border-slate-200 dark:border-slate-800`}
        >
          {/* List header */}
          <div className="px-4 pt-4 pb-2 flex items-start justify-between">
            <div>
              <h2 className="font-semibold tracking-tight">Messages</h2>
              <p className="text-xs text-slate-400">
                Incoming SMS to your numbers
              </p>
            </div>
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Refresh"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>

          {/* Tabs. Badge = unread (unopened) count, red, only when > 0. */}
          <div className="px-1 flex items-center border-b border-slate-200 dark:border-slate-800">
            {TABS.map((t) => {
              const on = tab === t.key;
              const unread = tabStats[t.key].unread;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  title={
                    iconsOnly
                      ? `${t.label} — ${tabStats[t.key].total} chats${
                          unread ? `, ${unread} unread` : ""
                        }`
                      : undefined
                  }
                  className={`relative flex items-center justify-center gap-1 h-9 text-sm font-medium border-b-2 -mb-px transition-colors flex-1 ${
                    iconsOnly ? "px-0" : "px-1"
                  } ${
                    on
                      ? "border-brand-600 text-brand-700 dark:text-brand-300"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="shrink-0 relative">
                    {t.icon}
                    {iconsOnly && unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </span>
                  {!iconsOnly && (
                    <span className="whitespace-nowrap">{t.label}</span>
                  )}
                  {!iconsOnly && unread > 0 && (
                    <span className="text-[11px] font-semibold rounded-full px-1.5 shrink-0 bg-red-500 text-white">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 h-10">
              <svg viewBox="0 0 24 24" width="16" height="16" className="text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto scroll-thin px-2 pb-2">
            {filtered.map(({ c, last }) => {
              const on = c.id === activeId;
              const title = titleFor(c);
              const sub = subFor(c);
              return (
                <button
                  key={c.id}
                  onClick={() => openContact(c.id)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors mb-0.5 ${
                    on
                      ? "bg-brand-50 dark:bg-brand-600/15"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Avatar label={title} color={c.avatarColor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate flex items-center gap-1">
                        {title}
                        {c.muted && <MuteIcon />}
                      </span>
                      <span
                        className={`text-[11px] shrink-0 ${
                          c.unread > 0
                            ? "text-brand-600 dark:text-brand-400 font-semibold"
                            : "text-slate-400"
                        }`}
                      >
                        {last ? listStamp(last.timestamp) : ""}
                      </span>
                    </div>
                    {sub && (
                      <div className="text-xs text-slate-400 truncate">{sub}</div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {last?.direction === "out" ? "You: " : ""}
                        {last?.body ?? "No messages yet"}
                      </span>
                      {c.unread > 0 && (
                        <span className="shrink-0 bg-brand-600 text-white text-[11px] font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 p-6">
                Nothing here.
              </p>
            )}
          </div>

          {/* Footer: unread / total conversations in the current tab */}
          <div className="px-4 h-9 shrink-0 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-400">
            {tabStats[tab].unread > 0 ? (
              <span>
                <span className="text-red-500 font-semibold">
                  {tabStats[tab].unread}
                </span>
                <span className="text-slate-400">
                  /{tabStats[tab].total} unread
                </span>
              </span>
            ) : (
              <span>
                {tabStats[tab].total}{" "}
                {tabStats[tab].total === 1 ? "chat" : "chats"}
              </span>
            )}
          </div>
        </aside>

        {/* Divider (desktop) */}
        <div
          onMouseDown={startDrag}
          className="hidden md:flex group w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-brand-500/20 active:bg-brand-500/30 transition-colors"
          title="Drag to resize"
        >
          <span className="h-8 w-0.5 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-brand-500 transition-colors" />
        </div>

        {/* RIGHT: chat pane */}
        <section
          className={`${
            mobilePane === "list" ? "hidden" : "flex"
          } md:flex flex-1 min-w-0 flex-col`}
        >
          {active ? (
            <>
              {/* Chat header */}
              <div className="min-h-14 shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setMobilePane("list")}
                  className="md:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Back"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>

                {/* Chips: number + name. Clicking sets THIS conversation's label. */}
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <Chip
                    active={modeFor(active) === "number"}
                    onClick={() => setMode(active, "number")}
                  >
                    {formatNumber(active.number)}
                  </Chip>
                  {activeName && (
                    <Chip
                      active={modeFor(active) === "name"}
                      onClick={() => setMode(active, "name")}
                    >
                      {activeName}
                    </Chip>
                  )}
                </div>

                {/* Actions */}
                <div className="ml-auto flex items-center gap-0.5 shrink-0">
                  <IconBtn
                    title={active.muted ? "Unmute" : "Mute"}
                    onClick={() => toggleMute(active.id)}
                    active={active.muted}
                  >
                    {active.muted ? <MuteIcon big /> : <BellIcon />}
                  </IconBtn>
                  <IconBtn
                    title="Archive"
                    onClick={() => setStatus(active.id, "archived")}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="4" rx="1" />
                      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
                    </svg>
                  </IconBtn>
                  <IconBtn
                    title={active.status === "blocked" ? "Unblock" : "Block"}
                    onClick={() =>
                      setStatus(
                        active.id,
                        active.status === "blocked" ? "inbox" : "blocked"
                      )
                    }
                    danger
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m4.9 4.9 14.2 14.2" strokeLinecap="round" />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Delete" onClick={() => remove(active.id)} danger>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </IconBtn>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto scroll-thin chat-canvas px-3 sm:px-6 py-4"
              >
                <div className="max-w-3xl mx-auto flex flex-col gap-1.5">
                  {renderWithDayDividers(active.messages)}
                </div>
              </div>

              {/* Composer */}
              <div className="shrink-0 px-3 sm:px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 sm:gap-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Type a reply…"
                  className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 h-11 text-sm outline-none focus:ring-2 focus:ring-brand-500/40 placeholder:text-slate-400"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim()}
                  className="h-11 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium flex items-center justify-center disabled:opacity-40 transition-colors"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 chat-canvas">
              Select a conversation to start chatting.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function clampWidth(px: number): number {
  const min = 300; // keeps all three tab labels visible
  const max =
    typeof window !== "undefined"
      ? Math.min(620, window.innerWidth - 360)
      : 620;
  return Math.max(min, Math.min(px, Math.max(min, max)));
}

function renderWithDayDividers(messages: Message[]) {
  const out: React.ReactNode[] = [];
  let lastDay = "";
  for (const m of messages) {
    const day = dayLabel(m.timestamp);
    if (day !== lastDay) {
      lastDay = day;
      out.push(
        <div key={`day-${m.id}`} className="self-center my-3">
          <span className="bg-white/80 dark:bg-slate-800/80 backdrop-blur text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wide rounded-full px-3 py-1 shadow-soft">
            {day}
          </span>
        </div>
      );
    }
    out.push(<Bubble key={m.id} m={m} />);
  }
  return out;
}

function Bubble({ m }: { m: Message }) {
  const out = m.direction === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-soft ${
          out
            ? "bg-brand-600 text-white rounded-br-md"
            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md"
        }`}
      >
        <span className="whitespace-pre-wrap break-words">{m.body}</span>
        <span className="inline-flex items-center gap-1 float-right ml-2 mt-1 translate-y-0.5">
          <span className={`text-[10px] ${out ? "text-white/70" : "text-slate-400"}`}>
            {timeShort(m.timestamp)}
          </span>
          {out && <Ticks status={m.status} />}
        </span>
      </div>
    </div>
  );
}

function Ticks({ status }: { status?: Message["status"] }) {
  const color = status === "read" ? "#a5f3fc" : "rgba(255,255,255,0.7)";
  if (status === "sent") {
    return (
      <svg viewBox="0 0 16 11" width="14" height="11" fill={color}>
        <path d="M11.07.65 5.4 6.32 3.03 3.95l-.7.7L5.4 7.72 11.77 1.35z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 11" width="16" height="11" fill={color}>
      <path d="M11.07.65 5.4 6.32 4.7 5.6l5.67-5.66zM14.07.65 8.4 6.32 6.03 3.95l-.7.7L8.4 7.72 14.77 1.35z" />
    </svg>
  );
}

function Avatar({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shrink-0 shadow-soft"
      style={{ backgroundColor: color }}
    >
      {initials(label)}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title="Set as the label shown in the list"
      className={`px-2.5 h-7 rounded-lg text-sm font-medium truncate max-w-[45vw] transition-colors ${
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger = false,
  active = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  const base =
    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors";
  const tone = danger
    ? "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
    : active
      ? "text-brand-600 bg-brand-50 dark:bg-brand-600/15"
      : "text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800";
  return (
    <button onClick={onClick} title={title} className={`${base} ${tone}`}>
      {children}
    </button>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function MuteIcon({ big = false }: { big?: boolean }) {
  const s = big ? 18 : 13;
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
      <path d="M18 8a6 6 0 0 0-9.3-5M6 8c0 7-3 9-3 9h13M13.7 21a2 2 0 0 1-3.4 0M2 2l20 20" />
    </svg>
  );
}
