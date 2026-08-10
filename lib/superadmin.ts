import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

// Returns the current user if they are a platform super-admin, else null.
// Super-admins are defined by the SUPERADMIN_EMAILS env var (comma-separated).
export async function getSuperadmin(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const allow = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return allow.includes(user.email.toLowerCase()) ? user : null;
}
