import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Ensures the caller is an admin of the given company.
async function requireAdmin(companyId: string) {
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
  if (m?.role !== "admin") return { error: "Forbidden", status: 403 as const };
  return { user, admin };
}

async function findUserIdByEmail(admin: SupabaseClient, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return undefined;
}

// GET /api/company/users?companyId=... — members with emails
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  const auth = await requireAdmin(companyId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: members } = await auth.admin
    .from("memberships")
    .select("id, user_id, username, role")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const withEmail = await Promise.all(
    (members ?? []).map(
      async (m: { id: string; user_id: string; username: string | null; role: string }) => {
        const { data } = await auth.admin.auth.admin.getUserById(m.user_id);
        return {
          userId: m.user_id,
          username: m.username,
          role: m.role,
          email: data.user?.email ?? "",
          isSelf: m.user_id === auth.user.id,
        };
      }
    )
  );

  return NextResponse.json({ members: withEmail });
}

// POST /api/company/users { companyId, email, password, role, username }
export async function POST(req: NextRequest) {
  const { companyId, email, password, role, username } = (await req.json()) as {
    companyId?: string;
    email?: string;
    password?: string;
    role?: string;
    username?: string;
  };
  if (!companyId || !email?.trim() || (role !== "admin" && role !== "viewer")) {
    return NextResponse.json({ error: "Email and role are required." }, { status: 400 });
  }
  const auth = await requireAdmin(companyId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let userId: string | undefined;
  const { data: created, error: createErr } = await auth.admin.auth.admin.createUser({
    email: email.trim(),
    password: password?.trim() || undefined,
    email_confirm: true,
  });
  if (created?.user) userId = created.user.id;
  else if (createErr) {
    userId = await findUserIdByEmail(auth.admin, email.trim());
    if (!userId) return NextResponse.json({ error: createErr.message }, { status: 400 });
  }
  if (!userId) return NextResponse.json({ error: "Could not create user." }, { status: 400 });

  const { error } = await auth.admin.from("memberships").upsert(
    { user_id: userId, company_id: companyId, role, username: username?.trim() || null },
    { onConflict: "user_id,company_id" }
  );
  if (error) return NextResponse.json({ error: "Could not add the user." }, { status: 400 });

  const reused = !created?.user;
  return NextResponse.json({
    ok: true,
    message: reused
      ? "Existing account added (their password is unchanged)."
      : "User created and added.",
  });
}

// PATCH /api/company/users { companyId, userId, role }
export async function PATCH(req: NextRequest) {
  const { companyId, userId, role } = (await req.json()) as {
    companyId?: string;
    userId?: string;
    role?: string;
  };
  if (!companyId || !userId || (role !== "admin" && role !== "viewer")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const auth = await requireAdmin(companyId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await auth.admin
    .from("memberships")
    .update({ role })
    .eq("company_id", companyId)
    .eq("user_id", userId);
  return NextResponse.json({ ok: true });
}

// DELETE /api/company/users { companyId, userId }
export async function DELETE(req: NextRequest) {
  const { companyId, userId } = (await req.json()) as {
    companyId?: string;
    userId?: string;
  };
  if (!companyId || !userId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const auth = await requireAdmin(companyId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (userId === auth.user.id) {
    return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  }

  await auth.admin
    .from("memberships")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
