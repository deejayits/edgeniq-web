import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/auth";
import { verifyTelegramAuth } from "@/lib/telegram-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { env } from "@/env";

// Telegram Login Widget redirects here with auth params as query string.
// We verify the hash FIRST (so a rejection shows a specific error in
// the URL) and only then call Auth.js signIn(). Previously the generic
// CredentialsSignin error was opaque — now the user sees the actual
// reason (bad hash / user not onboarded / soft-deleted / stale auth).
export async function GET(req: NextRequest) {
  // Per-IP rate limit. The Telegram signature check is cheap on its
  // own (HMAC-SHA256), but the Supabase user lookup that follows is
  // a network round-trip — and a flood of unauthenticated callbacks
  // burns Vercel function quota even if every signature fails. 10
  // attempts per 5 min per IP is generous for legitimate users
  // (one login + a couple retries) and brutal for a brute-forcer.
  const ip = clientIp(req.headers);
  const limit = checkRateLimit("auth-callback", ip, 10, 5 * 60 * 1000);
  if (!limit.ok) {
    console.warn(
      "[telegram-callback] rate-limited ip=%s reset_in=%dms",
      ip,
      limit.resetMs,
    );
    return NextResponse.redirect(
      new URL(
        "/login?error=signin_failed&reason=" +
          encodeURIComponent("too many attempts — try again in a few minutes"),
        req.url,
      ),
    );
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());

  // 1. Verify the Telegram signature.
  const verified = verifyTelegramAuth(params, env.TELEGRAM_BOT_TOKEN);
  if (!verified.ok) {
    console.warn("[telegram-callback] hash verification failed:", verified.reason);
    return NextResponse.redirect(
      new URL(
        `/login?error=telegram_hash&reason=${encodeURIComponent(verified.reason)}`,
        req.url,
      ),
    );
  }

  // 2. Look up the user in Supabase (bot account must exist).
  const tgUserId = verified.data.id;
  const db = supabaseAdmin();
  const { data: existing, error: dbErr } = await db
    .from("users")
    .select("chat_id, deleted")
    .eq("chat_id", tgUserId)
    .maybeSingle();

  if (dbErr) {
    console.error("[telegram-callback] supabase error:", dbErr);
    return NextResponse.redirect(
      new URL(
        `/login?error=supabase&reason=${encodeURIComponent(dbErr.message)}`,
        req.url,
      ),
    );
  }
  if (!existing) {
    return NextResponse.redirect(
      new URL(
        `/login?error=no_bot_account&tg_id=${tgUserId}`,
        req.url,
      ),
    );
  }
  if (existing.deleted) {
    return NextResponse.redirect(
      new URL("/login?error=account_deleted", req.url),
    );
  }

  // 3. Hand off to Auth.js which re-verifies (defense in depth) and
  //    mints the session JWT.
  try {
    await signIn("telegram", {
      ...params,
      redirect: true,
      redirectTo: "/app",
    });
    return NextResponse.redirect(new URL("/app", req.url));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[telegram-callback] signIn failed:", msg);
    return NextResponse.redirect(
      new URL(
        `/login?error=signin_failed&reason=${encodeURIComponent(msg.slice(0, 200))}`,
        req.url,
      ),
    );
  }
}
