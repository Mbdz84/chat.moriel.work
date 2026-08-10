import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listIncomingNumbers } from "@/lib/twilio";
import { normalizeNumber } from "@/lib/format";

export const runtime = "nodejs";

function inboundUrl(req: NextRequest): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get("host")}`;
  return `${base.replace(/\/$/, "")}/api/twilio/inbound`;
}

async function requireMember(companyId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  const admin = createAdminClient();
  const { data: m } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single();
  if (!m) return { error: "Forbidden", status: 403 as const };
  return { role: m.role as "admin" | "viewer", admin };
}

// GET /api/settings/twilio?companyId=...
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  const auth = await requireMember(companyId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, role } = auth;

  const { data: company } = await admin
    .from("companies")
    .select("twilio_account_sid, twilio_auth_token")
    .eq("id", companyId)
    .single();

  const { data: numbers } = await admin
    .from("numbers")
    .select("id, phone_number, label")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const url = inboundUrl(req);
  const accountSid = (company?.twilio_account_sid as string) ?? "";
  const token = (company?.twilio_auth_token as string) ?? "";

  const registered = new Set(
    (numbers ?? []).map((n: { phone_number: string }) => normalizeNumber(n.phone_number))
  );

  // Ask Twilio for all numbers in the account + their inbound webhook.
  const webhookByNumber: Record<string, boolean> = {};
  let discovered: {
    phoneNumber: string;
    friendlyName: string;
    connected: boolean;
    registered: boolean;
  }[] = [];
  let twilioError = false;
  if (accountSid && token) {
    try {
      const live = await listIncomingNumbers(accountSid, token);
      discovered = live.map((n) => {
        const connected = n.smsUrl.replace(/\/$/, "") === url;
        webhookByNumber[normalizeNumber(n.phoneNumber)] = connected;
        return {
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
          connected,
          registered: registered.has(normalizeNumber(n.phoneNumber)),
        };
      });
    } catch {
      twilioError = true;
    }
  }

  const rows = (numbers ?? []).map(
    (n: { id: string; phone_number: string; label: string | null }) => ({
      id: n.id,
      phone_number: n.phone_number,
      label: n.label,
      webhookConnected:
        accountSid && token
          ? webhookByNumber[normalizeNumber(n.phone_number)] ?? false
          : null,
    })
  );

  return NextResponse.json({
    role,
    isAdmin: role === "admin",
    accountSid,
    hasToken: Boolean(token),
    inboundUrl: url,
    numbers: rows,
    discovered,
    twilioError,
  });
}

// POST /api/settings/twilio
//   Save creds:  { companyId, accountSid, authToken }
//   Import:      { companyId, action: "import" }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    companyId?: string;
    accountSid?: string;
    authToken?: string;
    action?: string;
  };
  const companyId = body.companyId;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  const auth = await requireMember(companyId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "You have view-only access." }, { status: 403 });
  }

  // ---- Import numbers that already point at our webhook ----
  if (body.action === "import") {
    const { data: company } = await auth.admin
      .from("companies")
      .select("twilio_account_sid, twilio_auth_token")
      .eq("id", companyId)
      .single();
    const accountSid = company?.twilio_account_sid as string | undefined;
    const token = company?.twilio_auth_token as string | undefined;
    if (!accountSid || !token) {
      return NextResponse.json({ error: "Save your Twilio credentials first." }, { status: 400 });
    }

    const url = inboundUrl(req);
    let live;
    try {
      live = await listIncomingNumbers(accountSid, token);
    } catch {
      return NextResponse.json({ error: "Could not reach Twilio. Check your credentials." }, { status: 502 });
    }

    const { data: existing } = await auth.admin
      .from("numbers")
      .select("phone_number")
      .eq("company_id", companyId);
    const have = new Set(
      (existing ?? []).map((n: { phone_number: string }) => normalizeNumber(n.phone_number))
    );

    const toAdd = live
      .filter((n) => n.smsUrl.replace(/\/$/, "") === url)
      .filter((n) => !have.has(normalizeNumber(n.phoneNumber)))
      .map((n) => ({
        company_id: companyId,
        phone_number: n.phoneNumber,
        label: n.friendlyName || null,
      }));

    if (toAdd.length > 0) {
      await auth.admin.from("numbers").insert(toAdd);
    }
    return NextResponse.json({ ok: true, imported: toAdd.length });
  }

  // ---- Save credentials (only overwrite token if a new one was given) ----
  const patch: Record<string, string> = {};
  if (typeof body.accountSid === "string") patch.twilio_account_sid = body.accountSid.trim();
  if (body.authToken && body.authToken.trim()) patch.twilio_auth_token = body.authToken.trim();

  await auth.admin.from("companies").update(patch).eq("id", companyId);
  return NextResponse.json({ ok: true });
}
