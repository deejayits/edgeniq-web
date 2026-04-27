import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST /api/push/unsubscribe
// Body: { endpoint }
//
// Marks the row inactive instead of deleting. Hard-deleting would
// lose the audit trail of which device unsubscribed and when, which
// is useful when users complain "I'm not getting pushes" — we can
// see they unsubscribed from this device on this date.

export async function POST(req: Request) {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!tgUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json(
      { ok: false, error: "missing_endpoint" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  // Scoped to chat_id so a malicious caller can't deactivate someone
  // else's subscription by guessing the endpoint URL.
  const { error } = await sb
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("endpoint", body.endpoint)
    .eq("chat_id", tgUserId);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
