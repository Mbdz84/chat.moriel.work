import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperadmin } from "@/lib/superadmin";

export const runtime = "nodejs";

// Lightweight read of a company's Twilio numbers + labels, for any member
// (viewers included). Used by the chat list to show each source number's
// label. Uses the admin client behind a membership check so it works
// regardless of the numbers table's RLS.
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Super-admins have implicit access to every company; everyone else must be
  // an active member of this one.
  const isSuper = Boolean(await getSuperadmin());
  if (!isSuper) {
    const { data: m } = await admin
      .from("memberships")
      .select("id, disabled")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!m || m.disabled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: numbers } = await admin
    .from("numbers")
    .select("phone_number, label")
    .eq("company_id", companyId);

  return NextResponse.json({ numbers: numbers ?? [] });
}
