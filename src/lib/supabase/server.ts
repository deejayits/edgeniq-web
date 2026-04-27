import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
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

/**
 * Same client as supabaseAdmin() but enforces session presence
 * before handing it back. Use this in server actions / route
 * handlers where you want a hard "no anonymous access" guarantee
 * AND you'll filter by the returned chat_id on every query.
 *
 * Returns the chat_id alongside so callers don't have to call
 * auth() twice. Throws on missing session — there's no graceful
 * fallback for an action that's supposed to be authenticated.
 *
 * NOT a substitute for ownership filtering (.eq("chat_id", chatId))
 * — service-role still bypasses RLS. This wrapper just removes the
 * "forgot to check session" footgun. Defense-in-depth.
 */
export async function requireUserSupabase(): Promise<{
  sb: SupabaseClient;
  chatId: number;
}> {
  const session = await auth();
  const chatId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!chatId) {
    throw new Error("unauthorized: requireUserSupabase needs a session");
  }
  return { sb: supabaseAdmin(), chatId };
}
