import { NextResponse, type NextRequest } from "next/server";
import { getSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// POST /api/admin/users/ban { userId, banned }
// Disables (or re-enables) a user account globally — they can't sign in while
// banned. This affects all companies the user belongs to.
export async function POST(req: NextRequest) {
  const superadmin = await getSuperadmin();
  if (!superadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, banned } = (await req.json()) as {
    userId?: string;
    banned?: boolean;
  };
  if (!userId || typeof banned !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (userId === superadmin.id) {
    return NextResponse.json({ error: "You can't disable yourself." }, { status: 400 });
  }

  const admin = createAdminClient();
  // ban_duration "none" re-enables; a long duration disables.
  const { error } = await admin.auth.admin.updateUserById(userId, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ban_duration: banned ? "876000h" : "none",
  } as any);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
