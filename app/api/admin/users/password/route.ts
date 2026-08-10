import { NextResponse, type NextRequest } from "next/server";
import { getSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// POST /api/admin/users/password { userId, password }
export async function POST(req: NextRequest) {
  const superadmin = await getSuperadmin();
  if (!superadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, password } = (await req.json()) as {
    userId?: string;
    password?: string;
  };
  if (!userId || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
