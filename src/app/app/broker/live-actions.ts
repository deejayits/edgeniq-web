"use server";

// Live-trading actions — Phase 4a (infrastructure).
//
// These actions configure live mode and persist user choices, but do
// NOT place any live orders yet. The bot reads these flags during
// Phase 4b. Splitting the work this way means the multi-step opt-in
// UX, the disclaimer flow, the cap configuration, and the kill switch
// can all be reviewed + shipped without exposing real money to risk.
//
// Three independent gates must ALL be true for a live order to fire
// (when Phase 4b lands):
//
//   1. users.addon_live_trading      — Stripe entitlement
//   2. users.live_trading_enabled    — user opted in via web
//   3. users.live_acknowledged_at    — disclaimer signed (current version)
//
// Disabling, ack revocation, or kill switch flip any one of those
// instantly halts new orders. There is no "soft" pause — anything
// other than all-three-true means no live activity.

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { encrypt, type EncryptedBlob } from "@/lib/crypto";
import { AlpacaError, testConnection } from "@/lib/alpaca";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// Bumped when the disclaimer text changes materially. Old
// acknowledgements stop counting; users must re-accept. Keep this in
// lockstep with the disclaimer copy on /app/broker/live.
export const LIVE_DISCLAIMER_VERSION = 1;

// Floors / ceilings that the SQL CHECK constraints also enforce.
// Re-validated here so we can return a friendly error instead of a
// raw database constraint message.
const LIMITS = {
  position_usd: { min: 25, max: 10_000 },
  daily_loss_usd: { min: 50, max: 10_000 },
  open_positions: { min: 1, max: 10 },
} as const;

// ----------------------------------------------------------------------
// Auth + entitlement gates
// ----------------------------------------------------------------------

async function requireLiveEligible(): Promise<{
  chatId: number;
  hasAddon: boolean;
  isAdmin: boolean;
}> {
  const session = await auth();
  const user = session?.user as
    | { tgUserId?: number; role?: string }
    | undefined;
  if (!user?.tgUserId) throw new Error("unauthorized");

  const isAdmin =
    user.role === "admin" || user.role === "primary_admin";
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("users")
    .select(
      "addon_live_trading, sub_plan, sub_status",
    )
    .eq("chat_id", user.tgUserId)
    .maybeSingle();
  if (!data) throw new Error("user not found");

  // Must be Elite (or trial / admin) AND have the live add-on.
  const status = (data.sub_status ?? "").toLowerCase();
  const plan = (data.sub_plan ?? "").toLowerCase();
  const elite = isAdmin || status === "trial" || plan === "elite";
  if (!elite) throw new Error("Live trading requires Elite tier");

  const hasAddon = !!data.addon_live_trading || isAdmin;
  if (!hasAddon) {
    throw new Error(
      "Live Trading add-on not enabled on your account. Contact support to add it.",
    );
  }
  return { chatId: user.tgUserId, hasAddon, isAdmin };
}

// Best-effort audit log writer. Never throws; logging failure must
// not block the action that prompted it.
async function logEvent(
  chatId: number,
  eventType: string,
  payload: Record<string, unknown>,
  source: "web" | "bot" | "admin" | "system" = "web",
): Promise<void> {
  try {
    const sb = supabaseAdmin();
    await sb.from("live_trading_events").insert({
      chat_id: chatId,
      event_type: eventType,
      payload,
      source,
    });
  } catch {
    // Forensic log being unavailable shouldn't break user actions.
  }
}

// ----------------------------------------------------------------------
// Live broker connection (separate from paper)
// ----------------------------------------------------------------------

export async function testLiveAlpacaConnection(
  apiKey: string,
  apiSecret: string,
): Promise<
  ActionResult<{ accountId: string; buyingPower: string; status: string }>
> {
  await requireLiveEligible();
  if (!apiKey?.trim() || !apiSecret?.trim()) {
    return { ok: false, error: "API key and secret are required" };
  }
  try {
    const account = await testConnection(
      apiKey.trim(),
      apiSecret.trim(),
      "live",
    );
    return {
      ok: true,
      data: {
        accountId: account.id,
        buyingPower: account.buying_power,
        status: account.status,
      },
    };
  } catch (exc) {
    if (exc instanceof AlpacaError) {
      if (exc.status === 401 || exc.status === 403) {
        return {
          ok: false,
          error:
            "Alpaca rejected the live key/secret. Make sure you pasted a LIVE-trading key (not paper).",
        };
      }
      return {
        ok: false,
        error: `Alpaca ${exc.status} — verify the live key and try again.`,
      };
    }
    return {
      ok: false,
      error: exc instanceof Error ? exc.message : "Unknown error",
    };
  }
}

export async function saveLiveAlpacaConnection(
  apiKey: string,
  apiSecret: string,
): Promise<ActionResult> {
  const { chatId } = await requireLiveEligible();
  if (!apiKey?.trim() || !apiSecret?.trim()) {
    return { ok: false, error: "API key and secret are required" };
  }
  const cleanKey = apiKey.trim();
  const cleanSecret = apiSecret.trim();

  // Reject if the user is trying to save their PAPER key in the live
  // slot (and vice versa) by sniffing Alpaca's account response. Live
  // accounts have non-zero portfolio value or are funded; paper
  // accounts have specifically $100k.
  let account;
  try {
    account = await testConnection(cleanKey, cleanSecret, "live");
  } catch (exc) {
    if (
      exc instanceof AlpacaError &&
      (exc.status === 401 || exc.status === 403)
    ) {
      return {
        ok: false,
        error:
          "Alpaca rejected the live key/secret. Make sure you pasted a LIVE-trading key (not paper).",
      };
    }
    return {
      ok: false,
      error: exc instanceof Error ? exc.message : "Alpaca live test failed",
    };
  }

  const encKey: EncryptedBlob = encrypt(cleanKey);
  const encSecret: EncryptedBlob = encrypt(cleanSecret);

  const sb = supabaseAdmin();
  const { error } = await sb.from("broker_connections").upsert(
    {
      chat_id: chatId,
      broker: "alpaca",
      mode: "live",
      auth_method: "apikey",
      encrypted_api_key: encKey,
      encrypted_api_secret: encSecret,
      account_id: account.id,
      account_status: account.status,
      buying_power_at_connect: Number(account.buying_power),
      is_active: true,
      connected_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "chat_id,broker,mode" },
  );
  if (error) return { ok: false, error: error.message };

  await logEvent(chatId, "live_connection_saved", {
    account_id: account.id,
    buying_power: account.buying_power,
  });
  revalidatePath("/app/broker");
  return { ok: true };
}

export async function disconnectLiveBroker(): Promise<ActionResult> {
  const { chatId } = await requireLiveEligible();
  const sb = supabaseAdmin();
  // Hard-disable trading at the same time — disconnecting the broker
  // without flipping the enabled flag would leave a stale "enabled"
  // state that snaps back the moment a new connection is added.
  await sb
    .from("users")
    .update({ live_trading_enabled: false })
    .eq("chat_id", chatId);
  const { error } = await sb
    .from("broker_connections")
    .update({ is_active: false })
    .eq("chat_id", chatId)
    .eq("broker", "alpaca")
    .eq("mode", "live");
  if (error) return { ok: false, error: error.message };
  await logEvent(chatId, "live_disconnected", {});
  revalidatePath("/app/broker");
  return { ok: true };
}

// ----------------------------------------------------------------------
// Disclaimer + opt-in
// ----------------------------------------------------------------------

export async function acceptLiveDisclaimer(): Promise<ActionResult> {
  const { chatId } = await requireLiveEligible();
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("users")
    .update({
      live_acknowledged_at: new Date().toISOString(),
      live_acknowledged_version: LIVE_DISCLAIMER_VERSION,
    })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  await logEvent(chatId, "live_disclaimer_accepted", {
    version: LIVE_DISCLAIMER_VERSION,
  });
  revalidatePath("/app/broker");
  return { ok: true };
}

export async function setLiveTradingEnabled(
  enabled: boolean,
): Promise<ActionResult> {
  const { chatId } = await requireLiveEligible();
  const sb = supabaseAdmin();

  if (enabled) {
    // Pre-flight: must have signed the current disclaimer AND have a
    // live broker connection. Fail with a specific error so the UI
    // can route the user to the missing step.
    const { data: u } = await sb
      .from("users")
      .select(
        "live_acknowledged_at, live_acknowledged_version",
      )
      .eq("chat_id", chatId)
      .maybeSingle();
    if (
      !u?.live_acknowledged_at ||
      (u.live_acknowledged_version ?? 0) < LIVE_DISCLAIMER_VERSION
    ) {
      return {
        ok: false,
        error: "Disclaimer must be signed before enabling live trading.",
      };
    }
    const { data: conn } = await sb
      .from("broker_connections")
      .select("id")
      .eq("chat_id", chatId)
      .eq("broker", "alpaca")
      .eq("mode", "live")
      .eq("is_active", true)
      .maybeSingle();
    if (!conn) {
      return {
        ok: false,
        error: "Connect your live Alpaca account first.",
      };
    }
  }

  const { error } = await sb
    .from("users")
    .update({ live_trading_enabled: enabled })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  await logEvent(
    chatId,
    enabled ? "live_trading_enabled" : "live_trading_disabled",
    {},
  );
  revalidatePath("/app/broker");
  return { ok: true };
}

// ----------------------------------------------------------------------
// Caps
// ----------------------------------------------------------------------

export async function updateLiveCaps(opts: {
  position_usd?: number;
  daily_loss_usd?: number;
  open_positions?: number;
  confirmation_level?: "strict" | "standard";
}): Promise<ActionResult> {
  const { chatId } = await requireLiveEligible();
  const updates: Record<string, number | string> = {};

  if (opts.position_usd !== undefined) {
    if (
      !Number.isFinite(opts.position_usd) ||
      opts.position_usd < LIMITS.position_usd.min ||
      opts.position_usd > LIMITS.position_usd.max
    ) {
      return {
        ok: false,
        error: `Position cap must be $${LIMITS.position_usd.min}–$${LIMITS.position_usd.max.toLocaleString()}`,
      };
    }
    updates.live_max_position_usd = opts.position_usd;
  }
  if (opts.daily_loss_usd !== undefined) {
    if (
      !Number.isFinite(opts.daily_loss_usd) ||
      opts.daily_loss_usd < LIMITS.daily_loss_usd.min ||
      opts.daily_loss_usd > LIMITS.daily_loss_usd.max
    ) {
      return {
        ok: false,
        error: `Daily loss cap must be $${LIMITS.daily_loss_usd.min}–$${LIMITS.daily_loss_usd.max.toLocaleString()}`,
      };
    }
    updates.live_max_daily_loss_usd = opts.daily_loss_usd;
  }
  if (opts.open_positions !== undefined) {
    if (
      !Number.isInteger(opts.open_positions) ||
      opts.open_positions < LIMITS.open_positions.min ||
      opts.open_positions > LIMITS.open_positions.max
    ) {
      return {
        ok: false,
        error: `Max open positions must be ${LIMITS.open_positions.min}–${LIMITS.open_positions.max}`,
      };
    }
    updates.live_max_open_positions = opts.open_positions;
  }
  if (opts.confirmation_level !== undefined) {
    if (!["strict", "standard"].includes(opts.confirmation_level)) {
      return { ok: false, error: "Invalid confirmation level" };
    }
    updates.live_confirmation_level = opts.confirmation_level;
  }
  if (Object.keys(updates).length === 0) {
    return { ok: true };
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("users")
    .update(updates)
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };

  await logEvent(chatId, "live_caps_updated", { changes: updates });
  revalidatePath("/app/broker");
  return { ok: true };
}

// ----------------------------------------------------------------------
// Live kill switch — separate from paper kill switch
// ----------------------------------------------------------------------

export async function engageLiveKillSwitch(
  reason: string,
): Promise<ActionResult> {
  const { chatId } = await requireLiveEligible();
  const sb = supabaseAdmin();
  // Live kill switch flips live_trading_enabled OFF. Re-enabling
  // requires the user to go through setLiveTradingEnabled again,
  // which re-checks all gates. No silent re-arm.
  const { error } = await sb
    .from("users")
    .update({ live_trading_enabled: false })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  await logEvent(chatId, "live_kill_switch_engaged", {
    reason: reason?.slice(0, 200) ?? "user-engaged",
  });
  revalidatePath("/app/broker");
  return { ok: true };
}
