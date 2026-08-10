import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioSignature } from "@/lib/twilio";
import { normalizeNumber } from "@/lib/format";

export const runtime = "nodejs";

// Empty TwiML — tells Twilio we handled it, no auto-reply.
const TWIML_OK = new NextResponse("<Response></Response>", {
  status: 200,
  headers: { "Content-Type": "text/xml" },
});

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = String(v);
  });

  const from = params.From;
  const to = params.To;
  const body = params.Body ?? "";
  const sid = params.MessageSid ?? params.SmsMessageSid ?? null;
  if (!from || !to) return new NextResponse("bad request", { status: 400 });

  const admin = createAdminClient();

  // Which company owns the number that was texted?
  const { data: numbers } = await admin.from("numbers").select("company_id, phone_number");
  const match = (numbers ?? []).find(
    (n: { company_id: string; phone_number: string }) =>
      normalizeNumber(n.phone_number) === normalizeNumber(to)
  );
  // Unknown number: acknowledge so Twilio doesn't retry, but store nothing.
  if (!match) return TWIML_OK;
  const companyId = match.company_id;

  // Verify the request signature using this company's Twilio auth token.
  const { data: company } = await admin
    .from("companies")
    .select("twilio_auth_token")
    .eq("id", companyId)
    .single();
  const token = company?.twilio_auth_token as string | undefined;
  const skip = process.env.TWILIO_SKIP_VALIDATION === "1";
  if (token && !skip) {
    const host = req.headers.get("host");
    const url = `https://${host}/api/twilio/inbound`;
    const signature = req.headers.get("x-twilio-signature") ?? "";
    if (!validateTwilioSignature(token, signature, url, params)) {
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  // Find or create the conversation, then append the inbound message.
  const { data: convo } = await admin
    .from("conversations")
    .upsert(
      { company_id: companyId, our_number: to, contact_number: from },
      { onConflict: "company_id,our_number,contact_number" }
    )
    .select("id")
    .single();

  if (convo) {
    await admin.from("messages").insert({
      conversation_id: convo.id,
      company_id: companyId,
      direction: "in",
      body,
      status: "received",
      twilio_sid: sid,
    });
  }

  return TWIML_OK;
}
