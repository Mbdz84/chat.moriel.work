import { NextResponse, type NextRequest } from "next/server";
import { getSuperadmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/admin/companies — list all companies (super-admin only)
export async function GET() {
  const user = await getSuperadmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("companies")
    .select("id, code, name, created_at")
    .order("created_at", { ascending: true });

  // Member counts per company.
  const { data: members } = await admin.from("memberships").select("company_id");
  const counts: Record<string, number> = {};
  (members ?? []).forEach((m: { company_id: string }) => {
    counts[m.company_id] = (counts[m.company_id] ?? 0) + 1;
  });

  const companies = (data ?? []).map(
    (c: { id: string; code: string; name: string }) => ({
      ...c,
      members: counts[c.id] ?? 0,
    })
  );
  return NextResponse.json({ companies });
}

// POST /api/admin/companies { name, code }
export async function POST(req: NextRequest) {
  const user = await getSuperadmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, code } = (await req.json()) as { name?: string; code?: string };
  if (!name?.trim() || !code?.trim()) {
    return NextResponse.json({ error: "Name and code are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .insert({ name: name.trim(), code: code.trim() })
    .select("id, code, name")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "That company code is already taken." : "Could not create company.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ company: data });
}
