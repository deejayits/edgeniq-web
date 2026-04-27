import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST /api/push/subscribe
// Body: { endpoint, keys: { p256dh, auth }, userAgent? }
//
// Stores the browser's PushSubscription in public.push_subscriptions
// keyed by endpoint URL. Re-subscribing the same browser overwrites
// the prior row (endpoint is the PK), so the table never accumulates
// stale duplicates from a single device.
//
// Why not use the standard Supabase auth flow: we authenticate via
// NextAuth + Telegram, not Supabase Auth. The session.user.tgUserId
// IS the chat_id we want as the foreign key.

export async function POST(req: Request) {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!tgUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const authSecret = body.keys?.auth;
  if (!endpoint || !p256dh || !authSecret) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400 },
    );
  }

  // Length + shape validation. Without these, a malicious client
  // could submit a 10MB endpoint URL or binary garbage in the keys
  // and inflate the push_subscriptions table indefinitely (endpoint
  // is the upsert PK, so unique junk endpoints accumulate one row
  // per attempt). Conservative caps based on the actual W3C Push
  // spec field lengths.
  if (
    typeof endpoint !== "string" ||
    endpoint.length > 1000 ||
    !endpoint.startsWith("https://")
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_endpoint" },
      { status: 400 },
    );
  }
  // p256dh and auth are urlsafe-base64. Allow [A-Za-z0-9_=-]{,200}.
  // Matching length is ~88 chars for p256dh, ~24 for auth so 200 is
  // generous.
  const KEY_RE = /^[A-Za-z0-9_=-]{1,200}$/;
  if (
    typeof p256dh !== "string" ||
    !KEY_RE.test(p256dh) ||
    typeof authSecret !== "string" ||
    !KEY_RE.test(authSecret)
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_keys" },
      { status: 400 },
    );
  }
  // Trim user agent to a sane length; we only use it for diagnostic
  // display, not for auth.
  const userAgent =
    typeof body.userAgent === "string"
      ? body.userAgent.slice(0, 500)
      : null;

  const sb = supabaseAdmin();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      endpoint,
      chat_id: tgUserId,
      p256dh,
      auth: authSecret,
      user_agent: body.userAgent ?? null,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
