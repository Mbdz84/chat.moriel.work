import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Uses the public (publishable/anon) key — safe to
// ship to the browser. Sessions are stored in cookies via @supabase/ssr.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
