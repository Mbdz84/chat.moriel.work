import { NextResponse, type NextRequest } from "next/server";
import { getSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | undefined> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return undefined;
}

// GET /api/admin/users?companyId=... — members of a company
export async function GET(req: NextRequest) {
  const user = await getSuperadmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ members: [] });

  const admin = createAdminClient();
  const { data } = await admin
    .from("memberships")
    .select("id, user_id, username, role")
    .eq("company_id", companyId);
  return NextResponse.json({ members: data ?? [] });
}

// POST /api/admin/users { email, password, companyId, role, username }
// Creates the auth user if new (or reuses an existing one), then adds a
// membership to the company with the given role.
export async function POST(req: NextRequest) {
  const superadmin = await getSuperadmin();
  if (!superadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, password, companyId, role, username } = (await req.json()) as {
    email?: string;
    password?: string;
    companyId?: string;
    role?: string;
    username?: string;
  };

  if (!email?.trim() || !companyId || (role !== "admin" && role !== "viewer")) {
    return NextResponse.json({ error: "Email, company and role are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create the auth user, or reuse an existing account with this email.
  let userId: string | undefined;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: email.trim(),
    password: password?.trim() || undefined,
    email_confirm: true,
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (createErr) {
    // Likely already registered — find them.
    userId = await findUserIdByEmail(admin, email.trim());
    if (!userId) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }
  }
  if (!userId) return NextResponse.json({ error: "Could not create user." }, { status: 400 });

  const { error: memErr } = await admin.from("memberships").upsert(
    {
      user_id: userId,
      company_id: companyId,
      role,
      username: username?.trim() || null,
    },
    { onConflict: "user_id,company_id" }
  );
  if (memErr) {
    return NextResponse.json({ error: "Could not add the user to the company." }, { status: 400 });
  }

  const reused = !created?.user;
  return NextResponse.json({
    ok: true,
    reused,
    message: reused
      ? "Existing account added to the company (their current password is unchanged)."
      : "User created and added to the company.",
  });
}
