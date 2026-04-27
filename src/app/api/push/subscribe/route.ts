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
