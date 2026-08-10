import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/webpush";

export const runtime = "nodejs";

// Sends a test push to the current user's own devices. Useful for debugging.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id);

  const vapidConfigured = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );

  await sendPushToUsers(admin, [user.id], {
    title: "Test notification",
    body: "Push is working ✅",
    url: "/chat",
  });

  return NextResponse.json({
    ok: true,
    subscriptions: subs?.length ?? 0,
    vapidConfigured,
  });
}
