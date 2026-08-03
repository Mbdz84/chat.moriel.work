import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Supabase client for Server Components and Route Handlers. Reads the
// logged-in user's session from cookies. Still uses the public key, so all
// row-level-security rules apply as that user.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as never)
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware
            // refreshes the session.
          }
        },
      },
    }
  );
}
