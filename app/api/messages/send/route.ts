import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { conversationId, body } = (await req.json()) as {
    conversationId?: string;
    body?: string;
  };
  if (!conversationId || !body?.trim()) {
    return NextResponse.json({ error: "Missing message." }, { status: 400 });
  }

  // Who is calling? (session from cookies)
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  // Load the conversation as the user — RLS guarantees they're a member.
  const { data: convo, error } = await supabase
    .from("conversations")
    .select("id, company_id, our_number, contact_number")
    .eq("id", conversationId)
    .single();
  if (error || !convo) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const admin = createAdminClient();

  // Only admins may send.
  const { data: membership } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", convo.company_id)
    .single();
  if (membership?.role !== "admin") {
    return NextResponse.json(
      { error: "You have view-only access." },
      { status: 403 }
    );
  }

  // Company's Twilio credentials.
  const { data: company } = await admin
    .from("companies")
    .select("twilio_account_sid, twilio_auth_token")
    .eq("id", convo.company_id)
    .single();
  if (!company?.twilio_account_sid || !company?.twilio_auth_token) {
    return NextResponse.json(
      { error: "Twilio is not configured for this company." },
      { status: 400 }
    );
  }

  let sid: string | null = null;
  let status = "sent";
  try {
    const r = await sendSms({
      accountSid: company.twilio_account_sid,
      authToken: company.twilio_auth_token,
      from: convo.our_number,
      to: convo.contact_number,
      body: body.trim(),
    });
    sid = r.sid;
    status = r.status;
  } catch (e) {
    status = "failed";
  }

  // Record the outgoing message (admin client — already authorized above).
  await admin.from("messages").insert({
    conversation_id: convo.id,
    company_id: convo.company_id,
    direction: "out",
    body: body.trim(),
    status,
    twilio_sid: sid,
  });

  if (status === "failed") {
    return NextResponse.json({ error: "Twilio rejected the message." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, status, sid });
}
