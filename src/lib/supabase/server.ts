import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

// Service-role client — bypasses RLS. Use only in server components,
// route handlers, and server actions AFTER validating the session. The
// caller is responsible for filtering queries to the authenticated user
// (e.g. .eq("chat_id", session.user.tgUserId)). Never expose this client
// to the browser.
//
// Lazily created so next build doesn't crash when env vars are
// momentarily missing (e.g. during the first Vercel deploy before env
// has been wired up).
let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _admin;
}
