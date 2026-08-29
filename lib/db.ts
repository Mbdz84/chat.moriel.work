import { createClient } from "./supabase/client";

export type ConvoStatus = "inbox" | "blocked" | "archived";

export type DbConversation = {
  id: string;
  company_id: string;
  our_number: string;
  contact_number: string;
  channel: "sms" | "whatsapp";
  status: ConvoStatus;
  muted: boolean;
  unread: number;
  last_body: string | null;
  last_direction: "in" | "out" | null;
  last_message_at: string;
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  channel: "sms" | "whatsapp";
  body: string;
  status: string | null;
  created_at: string;
  media_urls: string[] | null;
};

export async function fetchConversations(companyId: string): Promise<DbConversation[]> {
  const s = createClient();
  const { data } = await s
    .from("conversations")
    .select("*")
    .eq("company_id", companyId)
    .order("last_message_at", { ascending: false });
  return (data ?? []) as DbConversation[];
}

export type DbNumber = { phone_number: string; label: string | null };

// The company's Twilio numbers with their labels. Read through a server route
// so it works for viewers too (the numbers table's RLS may be admin-only).
export async function fetchNumbers(companyId: string): Promise<DbNumber[]> {
  try {
    const res = await fetch(
      `/api/company/numbers?companyId=${encodeURIComponent(companyId)}`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { numbers?: DbNumber[] };
    return data.numbers ?? [];
  } catch {
    return [];
  }
}

export async function fetchMessages(conversationId: string): Promise<DbMessage[]> {
  const s = createClient();
  const { data } = await s
    .from("messages")
    .select("id, conversation_id, direction, channel, body, status, created_at, media_urls")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as DbMessage[];
}

export async function patchConversation(
  id: string,
  patch: Partial<Pick<DbConversation, "status" | "muted" | "unread">>
): Promise<void> {
  const s = createClient();
  await s.from("conversations").update(patch).eq("id", id);
}

export async function deleteConversation(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const s = createClient();
  // `count: "exact"` tells us how many rows were actually removed. Row-Level
  // Security can make a delete silently affect zero rows (no error is thrown),
  // so a successful call that deleted nothing means we lacked permission.
  const { error, count } = await s
    .from("conversations")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!count) {
    return {
      ok: false,
      error:
        "Nothing was deleted — the database blocked it. Add a DELETE policy for conversations in Supabase.",
    };
  }
  return { ok: true };
}

// Send an outgoing SMS (server route handles Twilio + writing the row).
export async function sendMessage(
  conversationId: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, body }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "Failed to send." };
  }
  return { ok: true };
}
