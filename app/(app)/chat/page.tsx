"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  timeShort,
  listStamp,
  dayLabel,
  initials,
  formatNumber,
  normalizeNumber,
} from "@/lib/format";
import { useCallerId } from "@/lib/callerId";
import { useCompany } from "@/lib/company";
import {
  fetchConversations,
  fetchMessages,
  patchConversation,
  deleteConversation,
  sendMessage,
  type DbConversation,
  type DbMessage,
  type ConvoStatus,
} from "@/lib/db";
import { createClient } from "@/lib/supabase/client";

type DisplayMode = "name" | "number";

const AVATAR_COLORS = [
  "#6366f1", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6",
  "#0ea5e9", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];
function colorFor(num: string): string {
  let h = 0;
  for (const ch of num) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

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

export default function ChatPage() {
  const { nameFor } = useCallerId();
  const { active: activeCompany, loading: companyLoading } = useCompany();
  const companyId = activeCompany?.companyId ?? null;

  const [conversations, setConversations] = useState<DbConversation[]>([]);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [tab, setTab] = useState<ConvoStatus>("inbox");
  const [activeId, setActiveId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [listWidth, setListWidth] = useState(360);
  const [isDesktop, setIsDesktop] = useState(false);
  const [convoModes, setConvoModes] = useState<Record<string, DisplayMode>>({});
  const draggingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef("");
  activeIdRef.current = activeId;

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const compactPad = isDesktop && listWidth < 320;

  // ----- display mode helpers (per conversation, persisted by number) -----
  function modeFor(c: DbConversation): DisplayMode {
    const explicit = convoModes[normalizeNumber(c.contact_number)];
    if (explicit) return explicit;
    return nameFor(c.contact_number) ? "name" : "number";
  }
  function setMode(c: DbConversation, mode: DisplayMode) {
    setConvoModes((prev) => {
      const next = { ...prev, [normalizeNumber(c.contact_number)]: mode };
      try {
        localStorage.setItem("convoModes", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  function titleFor(c: DbConversation): string {
    const name = nameFor(c.contact_number);
    if (modeFor(c) === "name" && name) return name;
    return formatNumber(c.contact_number);
  }
  function subFor(c: DbConversation): string | null {
    const name = nameFor(c.contact_number);
    if (modeFor(c) === "name") return name ? formatNumber(c.contact_number) : null;
    return name ?? null;
  }

  // Tell the top-bar badge to recount immediately (its realtime can lag).
  function notifyUnread() {
    try {
      window.dispatchEvent(new Event("chat:unread"));
    } catch {}
  }

  // ----- load conversations for the active company -----
  const loadConversations = useCallback(async () => {
    if (!companyId) {
      setConversations([]);
      return;
    }
    setConversations(await fetchConversations(companyId));
    notifyUnread();
  }, [companyId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ----- realtime: refresh on any message/conversation change -----
  useEffect(() => {
    if (!companyId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`company-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `company_id=eq.${companyId}` },
        (payload: { new?: { conversation_id?: string } }) => {
          const cid = payload.new?.conversation_id;
          if (cid && cid === activeIdRef.current) {
            // Message landed in the conversation that's open on screen — it's
            // already read, so clear unread in the DB before refreshing the list
            // (otherwise the trigger's +1 leaves a stuck badge).
            fetchMessages(activeIdRef.current).then(setMessages);
            patchConversation(cid, { unread: 0 }).then(loadConversations);
          } else {
            loadConversations();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `company_id=eq.${companyId}` },
        () => loadConversations()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, loadConversations]);

  // ----- load messages when the active conversation changes -----
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    fetchMessages(activeId).then(setMessages);
  }, [activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, messages.length]);

  // ----- desktop breakpoint + saved widths/modes -----
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

  // ----- derived lists -----
  const tabStats = useMemo(() => {
    const blank = () => ({ total: 0, unread: 0 });
    const s: Record<ConvoStatus, { total: number; unread: number }> = {
      inbox: blank(), blocked: blank(), archived: blank(),
    };
    conversations.forEach((c) => {
      s[c.status].total += 1;
      if (c.unread > 0) s[c.status].unread += 1;
    });
    return s;
  }, [conversations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = conversations.filter((c) => c.status === tab);
    if (!q) return rows;
    return rows.filter((c) => {
      const name = nameFor(c.contact_number)?.toLowerCase() ?? "";
      return c.contact_number.includes(q) || name.includes(q);
    });
  }, [conversations, tab, search, nameFor]);

  // Keep a valid active conversation for the current tab.
  useEffect(() => {
    if (!active || active.status !== tab) {
      setActiveId(filtered[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, conversations]);

  function openConversation(id: string) {
    setActiveId(id);
    setMobilePane("chat");
    setSendError("");
    const c = conversations.find((x) => x.id === id);
    if (c && c.unread > 0) {
      setConversations((prev) => prev.map((x) => (x.id === id ? { ...x, unread: 0 } : x)));
      patchConversation(id, { unread: 0 }).then(notifyUnread);
    }
  }

  async function onSend() {
    const body = draft.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setSendError("");
    const res = await sendMessage(active.id, body);
    setSending(false);
    if (!res.ok) {
      setSendError(res.error ?? "Failed to send.");
      return;
    }
    setDraft("");
    fetchMessages(active.id).then(setMessages);
    loadConversations();
  }

  function setStatus(id: string, status: ConvoStatus) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    patchConversation(id, { status });
    setMobilePane("list");
  }
  function toggleMute(c: DbConversation) {
    setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, muted: !x.muted } : x)));
    patchConversation(c.id, { muted: !c.muted });
  }
  function removeConvo(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    deleteConversation(id);
    setMobilePane("list");
  }

  const activeName = active ? nameFor(active.contact_number) : undefined;
  const showEmpty = !companyLoading && !companyId;

  return (
    <div className="h-full p-2 sm:p-3 md:p-4">
      <div className="h-full flex rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft overflow-hidden">
        {/* LEFT: conversation list */}
        <aside
          style={isDesktop ? { width: listWidth } : undefined}
          className={`${mobilePane === "chat" ? "hidden" : "flex"} md:flex w-full shrink-0 flex-col border-r border-slate-200 dark:border-slate-800`}
        >
          <div className="px-4 pt-4 pb-2 flex items-start justify-between">
            <div>
              <h2 className="font-semibold tracking-tight">Messages</h2>
              <p className="text-xs text-slate-400">Incoming SMS to your numbers</p>
            </div>
            <button
              onClick={() => loadConversations()}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Refresh"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="px-1 flex items-center border-b border-slate-200 dark:border-slate-800">
            {TABS.map((t) => {
              const on = tab === t.key;
              const unread = tabStats[t.key].unread;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative flex items-center justify-center gap-1 h-9 text-sm font-medium border-b-2 -mb-px transition-colors flex-1 ${
                    compactPad ? "px-0.5" : "px-1"
                  } ${
                    on
                      ? "border-brand-600 text-brand-700 dark:text-brand-300"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="shrink-0">{t.icon}</span>
                  <span className="whitespace-nowrap">{t.label}</span>
                  {unread > 0 && (
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
            {filtered.map((c) => {
              const on = c.id === activeId;
              const title = titleFor(c);
              const sub = subFor(c);
              return (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors mb-0.5 ${
                    on ? "bg-brand-50 dark:bg-brand-600/15" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Avatar label={title} color={colorFor(c.contact_number)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium truncate flex items-center gap-1">
                        {title}
                        {c.muted && <MuteIcon />}
                      </span>
                      <span className="flex flex-col items-end shrink-0 leading-tight">
                        <span className={`text-[11px] ${c.unread > 0 ? "text-brand-600 dark:text-brand-400 font-semibold" : "text-slate-400"}`}>
                          {listStamp(c.last_message_at)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatNumber(c.our_number)}
                        </span>
                      </span>
                    </div>
                    {sub && <div className="text-xs text-slate-400 truncate">{sub}</div>}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {c.last_direction === "out" ? "You: " : ""}
                        {c.last_body ?? "No messages yet"}
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
                {showEmpty ? "No company selected." : "Nothing here yet."}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 h-9 shrink-0 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-400">
            {tabStats[tab].unread > 0 ? (
              <span>
                <span className="text-red-500 font-semibold">{tabStats[tab].unread}</span>
                <span>/{tabStats[tab].total} unread</span>
              </span>
            ) : (
              <span>{tabStats[tab].total} {tabStats[tab].total === 1 ? "chat" : "chats"}</span>
            )}
          </div>
        </aside>

        {/* Divider */}
        <div
          onMouseDown={startDrag}
          className="hidden md:flex group w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-brand-500/20 active:bg-brand-500/30 transition-colors"
          title="Drag to resize"
        >
          <span className="h-8 w-0.5 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-brand-500 transition-colors" />
        </div>

        {/* RIGHT: chat pane */}
        <section className={`${mobilePane === "list" ? "hidden" : "flex"} md:flex flex-1 min-w-0 flex-col`}>
          {active ? (
            <>
              {/* Header */}
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

                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <Chip active={modeFor(active) === "number"} onClick={() => setMode(active, "number")}>
                    {formatNumber(active.contact_number)}
                  </Chip>
                  {activeName && (
                    <Chip active={modeFor(active) === "name"} onClick={() => setMode(active, "name")}>
                      {activeName}
                    </Chip>
                  )}
                  <span className="text-xs text-slate-400 hidden sm:block">
                    via {formatNumber(active.our_number)}
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-0.5 shrink-0">
                  <IconBtn title={active.muted ? "Unmute" : "Mute"} onClick={() => toggleMute(active)} active={active.muted}>
                    {active.muted ? <MuteIcon big /> : <BellIcon />}
                  </IconBtn>
                  <IconBtn title="Archive" onClick={() => setStatus(active.id, "archived")}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="4" rx="1" />
                      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
                    </svg>
                  </IconBtn>
                  <IconBtn
                    title={active.status === "blocked" ? "Unblock" : "Block"}
                    onClick={() => setStatus(active.id, active.status === "blocked" ? "inbox" : "blocked")}
                    danger
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m4.9 4.9 14.2 14.2" strokeLinecap="round" />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Delete" onClick={() => removeConvo(active.id)} danger>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </IconBtn>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin chat-canvas px-3 sm:px-6 py-4">
                <div className="max-w-3xl mx-auto flex flex-col gap-1.5">
                  {renderWithDayDividers(messages)}
                </div>
              </div>

              {/* Composer */}
              <div className="shrink-0 border-t border-slate-200 dark:border-slate-800">
                {sendError && <p className="px-4 pt-2 text-xs text-red-500">{sendError}</p>}
                <div className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                    placeholder="Type a reply…"
                    className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 h-11 text-sm outline-none focus:ring-2 focus:ring-brand-500/40 placeholder:text-slate-400"
                  />
                  <button
                    onClick={onSend}
                    disabled={!draft.trim() || sending}
                    className="h-11 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium flex items-center justify-center disabled:opacity-40 transition-colors"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 chat-canvas text-sm px-6 text-center">
              {showEmpty
                ? "Select a company to see conversations."
                : "Select a conversation, or wait for the first message to arrive."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function clampWidth(px: number): number {
  const min = 300;
  const max = typeof window !== "undefined" ? Math.min(620, window.innerWidth - 360) : 620;
  return Math.max(min, Math.min(px, Math.max(min, max)));
}

function renderWithDayDividers(messages: DbMessage[]) {
  const out: React.ReactNode[] = [];
  let lastDay = "";
  for (const m of messages) {
    const day = dayLabel(m.created_at);
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

function Bubble({ m }: { m: DbMessage }) {
  const out = m.direction === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-soft ${
          out ? "bg-brand-600 text-white rounded-br-md" : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md"
        }`}
      >
        {m.media_urls && m.media_urls.length > 0 && (
          <span className="block mb-1 space-y-1">
            {m.media_urls.map((_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`/api/media?m=${m.id}&i=${i}`}
                alt="Attachment"
                className="rounded-lg max-w-full max-h-72 object-cover block"
              />
            ))}
          </span>
        )}
        {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
        <span className="inline-flex items-center gap-1 float-right ml-2 mt-1 translate-y-0.5">
          <span className={`text-[10px] ${out ? "text-white/70" : "text-slate-400"}`}>
            {timeShort(m.created_at)}
          </span>
          {out && <Ticks status={m.status} />}
        </span>
      </div>
    </div>
  );
}

function Ticks({ status }: { status: string | null }) {
  const read = status === "read";
  const single = status === "queued" || status === "sent" || status === "sending";
  const color = read ? "#a5f3fc" : "rgba(255,255,255,0.7)";
  if (single) {
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

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Set as the label shown in the list"
      className={`px-2.5 h-7 rounded-lg text-sm font-medium truncate max-w-[45vw] transition-colors ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({
  children, title, onClick, danger = false, active = false,
}: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean; active?: boolean;
}) {
  const base = "w-9 h-9 rounded-lg flex items-center justify-center transition-colors";
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
