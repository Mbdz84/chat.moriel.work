import { NextResponse } from "next/server";
import { getSuperadmin } from "@/lib/superadmin";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSuperadmin();
  return NextResponse.json({ isSuperadmin: Boolean(user) });
}
