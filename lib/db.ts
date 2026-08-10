import { createClient } from "./supabase/client";

export type ConvoStatus = "inbox" | "blocked" | "archived";

export type DbConversation = {
  id: string;
  company_id: string;
  our_number: string;
  contact_number: string;
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

export async function fetchMessages(conversationId: string): Promise<DbMessage[]> {
  const s = createClient();
  const { data } = await s
    .from("messages")
    .select("id, conversation_id, direction, body, status, created_at, media_urls")
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

export async function deleteConversation(id: string): Promise<void> {
  const s = createClient();
  await s.from("conversations").delete().eq("id", id);
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
