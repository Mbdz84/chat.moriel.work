import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Exposes the *public* VAPID key so the service worker can resubscribe on its
// own after the browser rotates a subscription. This key is public by design
// (it already ships to the browser as NEXT_PUBLIC_VAPID_PUBLIC_KEY).
export function GET() {
  return NextResponse.json({
    key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  });
}
