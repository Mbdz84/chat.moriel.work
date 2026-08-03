import { createClient } from "@supabase/supabase-js";

// Admin client — uses the SECRET (service_role) key and BYPASSES row-level
// security. Server-side ONLY. Never import this into a client component.
// Used by the Twilio webhook (inbound SMS) and admin operations.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
