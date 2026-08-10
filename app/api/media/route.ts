import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/media?m=<messageId>&i=<index>
// Streams a Twilio media file. Access is gated by RLS: the message is read as
// the logged-in user, so only members (or super-admins) of its company can see
// it. Twilio credentials are used server-side to fetch the file.
export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get("m");
  const index = parseInt(req.nextUrl.searchParams.get("i") || "0", 10) || 0;
  if (!messageId) return new Response("Bad request", { status: 400 });

  const supabase = createClient();
  const { data: msg } = await supabase
    .from("messages")
    .select("company_id, media_urls")
    .eq("id", messageId)
    .single();

  const urls = (msg?.media_urls as string[] | null) ?? null;
  if (!msg || !urls || !urls[index]) return new Response("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("twilio_account_sid, twilio_auth_token")
    .eq("id", msg.company_id)
    .single();
  if (!company?.twilio_account_sid || !company?.twilio_auth_token) {
    return new Response("Media unavailable", { status: 404 });
  }

  const authHeader =
    "Basic " +
    Buffer.from(`${company.twilio_account_sid}:${company.twilio_auth_token}`).toString("base64");
  const res = await fetch(urls[index], { headers: { Authorization: authHeader } });
  if (!res.ok) return new Response("Media unavailable", { status: 502 });

  const buf = await res.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
