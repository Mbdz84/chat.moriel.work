import { NextResponse, type NextRequest } from "next/server";
import { getSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// PATCH /api/admin/companies/:id  { disabled: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSuperadmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { disabled } = (await req.json()) as { disabled?: boolean };
  if (typeof disabled !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ disabled })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/companies/:id  — removes the company and all its data.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSuperadmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  // Memberships, numbers, caller_id, conversations and messages are removed
  // automatically via ON DELETE CASCADE.
  const { error } = await admin.from("companies").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Delete failed." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
