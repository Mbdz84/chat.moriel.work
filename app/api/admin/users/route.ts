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

// GET /api/admin/users?companyId=... — members with email + banned status
export async function GET(req: NextRequest) {
  const superadmin = await getSuperadmin();
  if (!superadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ members: [] });

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("memberships")
    .select("user_id, username, role")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const withInfo = await Promise.all(
    (members ?? []).map(
      async (m: { user_id: string; username: string | null; role: string }) => {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bu = (data.user as any)?.banned_until as string | null | undefined;
        const banned = Boolean(bu && new Date(bu).getTime() > Date.now());
        return {
          userId: m.user_id,
          username: m.username,
          role: m.role,
          email: data.user?.email ?? "",
          banned,
          isSelf: m.user_id === superadmin.id,
        };
      }
    )
  );
  return NextResponse.json({ members: withInfo });
}

// POST /api/admin/users { email, password, companyId, role, username }
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
  let userId: string | undefined;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: email.trim(),
    password: password?.trim() || undefined,
    email_confirm: true,
  });
  if (created?.user) userId = created.user.id;
  else if (createErr) {
    userId = await findUserIdByEmail(admin, email.trim());
    if (!userId) return NextResponse.json({ error: createErr.message }, { status: 400 });
  }
  if (!userId) return NextResponse.json({ error: "Could not create user." }, { status: 400 });

  const { error: memErr } = await admin.from("memberships").upsert(
    { user_id: userId, company_id: companyId, role, username: username?.trim() || null },
    { onConflict: "user_id,company_id" }
  );
  if (memErr) return NextResponse.json({ error: "Could not add the user." }, { status: 400 });

  const reused = !created?.user;
  return NextResponse.json({
    ok: true,
    reused,
    message: reused
      ? "Existing account added (password unchanged)."
      : "User created and added.",
  });
}

// PATCH /api/admin/users { companyId, userId, role?, username? }
export async function PATCH(req: NextRequest) {
  const superadmin = await getSuperadmin();
  if (!superadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { companyId, userId, role, username } = (await req.json()) as {
    companyId?: string;
    userId?: string;
    role?: string;
    username?: string;
  };
  if (!companyId || !userId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {};
  if (role === "admin" || role === "viewer") patch.role = role;
  if (typeof username === "string") patch.username = username.trim() || null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  await admin.from("memberships").update(patch).eq("company_id", companyId).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users { companyId, userId } — remove from company
export async function DELETE(req: NextRequest) {
  const superadmin = await getSuperadmin();
  if (!superadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { companyId, userId } = (await req.json()) as {
    companyId?: string;
    userId?: string;
  };
  if (!companyId || !userId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("memberships").delete().eq("company_id", companyId).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
