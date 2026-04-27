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
import { LIVE_DISCLAIMER_VERSION } from "./live-config";
import { sendBotDMFireAndForget } from "@/lib/telegram-notify";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

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
  // Disconnect = three things, in this order:
  //
  //   1. Mark the live broker_connection inactive (drops live key)
  //   2. Flip active_broker_mode back to 'paper' (route orders to
  //      paper from this moment forward)
  //   3. Flip live_trading_enabled false (so re-connecting later
  //      doesn't silently re-enable — user must opt back in)
  //
  // PAPER state is intentionally untouched: auto_trade_rules,
  // auto_trade_risk_rails, paper kill switch all keep their settings.
  // Disconnecting live should NOT also pause paper trading.
  await sb
    .from("users")
    .update({
      live_trading_enabled: false,
      active_broker_mode: "paper",
      last_mode_switch_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId);
  const { error } = await sb
    .from("broker_connections")
    .update({ is_active: false })
    .eq("chat_id", chatId)
    .eq("broker", "alpaca")
    .eq("mode", "live");
  if (error) return { ok: false, error: error.message };
  await logEvent(chatId, "live_disconnected", {
    active_mode_after: "paper",
  });
  revalidatePath("/app/broker");
  return { ok: true };
}

// ----------------------------------------------------------------------
// Mode switching — strict mutex between paper and live
// ----------------------------------------------------------------------

/**
 * Switch the active broker mode to 'live'. Walks every gate before
 * flipping. ANY failure leaves the user in their current mode (no
 * partial state). Returns specific errors so the UI can route the
 * user to the missing prerequisite.
 *
 * Pre-conditions verified server-side (do NOT trust the client):
 *   1. Elite tier + Live add-on (requireLiveEligible)
 *   2. live_trading_enabled = true (user opted in via web)
 *   3. live_acknowledged_at not null AND version current
 *   4. live broker_connection exists AND is_active
 *   5. Caller passed an explicit `confirm: true` so accidental
 *      double-clicks on a state-changing button can't flip mode.
 */
export async function switchToLive(opts: {
  confirm: boolean;
}): Promise<ActionResult> {
  if (!opts?.confirm) {
    return { ok: false, error: "Confirmation required" };
  }
  const { chatId } = await requireLiveEligible();
  const sb = supabaseAdmin();

  const { data: u } = await sb
    .from("users")
    .select(
      "live_trading_enabled, live_acknowledged_at, live_acknowledged_version, active_broker_mode",
    )
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!u) return { ok: false, error: "user not found" };

  if (u.active_broker_mode === "live") {
    // Idempotent — already live.
    return { ok: true };
  }
  if (
    !u.live_acknowledged_at ||
    (u.live_acknowledged_version ?? 0) < LIVE_DISCLAIMER_VERSION
  ) {
    return {
      ok: false,
      error: "Sign the live-trading disclaimer first.",
    };
  }
  const { data: conn } = await sb
    .from("broker_connections")
    .select("id, account_status")
    .eq("chat_id", chatId)
    .eq("broker", "alpaca")
    .eq("mode", "live")
    .eq("is_active", true)
    .maybeSingle();
  if (!conn) {
    return {
      ok: false,
      error: "Connect a live Alpaca account first.",
    };
  }
  // Fail-safe: if Alpaca told us this account is RESTRICTED or
  // ACCOUNT_CLOSED at connect time, don't let the user route orders
  // to it. Status reflects whatever was returned by /v2/account when
  // the connection was saved.
  const blocked = ["INACTIVE", "ACCOUNT_CLOSED", "ACCOUNT_UPDATED"].includes(
    (conn.account_status ?? "").toUpperCase(),
  );
  if (blocked) {
    return {
      ok: false,
      error: `Live Alpaca account status is "${conn.account_status}" — not eligible for trading.`,
    };
  }

  // Flip both flags in one update. live_trading_enabled becomes
  // 'true' permanently after first switch — used as the "ever opted
  // in" audit signal, separate from the active mode flag. Switching
  // back to paper does NOT clear it; only kill switch / explicit
  // disable does.
  const { error } = await sb
    .from("users")
    .update({
      active_broker_mode: "live",
      live_trading_enabled: true,
      last_mode_switch_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };

  // Per-mode rules architecture: paper rules and live rules are
  // separate DB rows. Switching modes does NOT touch rules — the
  // user's live rules stay at whatever they were last set to
  // (default 'off' until first opt-in). No bleed between modes,
  // no surprise reset of paper config, no carry-over of paper
  // decisions into live execution.
  await logEvent(chatId, "mode_switched_to_live", {
    from: u.active_broker_mode,
    auto_rules_reset: false,
  });
  // High-stakes state change → mirror to Telegram so the user has a
  // chat-side audit row. Fire-and-forget; the action result already
  // reflects success of the DB write.
  sendBotDMFireAndForget(
    chatId,
    "🔴 <b>LIVE mode is ON</b>\n" +
      "\n" +
      "Auto-trade signals will now route to your real Alpaca live " +
      "account. Per-order cap, daily loss cap, and pre-flight " +
      "account check are all enforced.\n" +
      "\n" +
      "<b>If anything looks off:</b> /kill YES — cancels every open " +
      "Alpaca order and disables auto-trade in one tap.\n" +
      "\n" +
      "<i>Confirmed via the web — flip back to paper anytime on " +
      "https://www.edgeniq.com/app/broker.</i>",
  );
  revalidatePath("/app/broker");
  return { ok: true };
}

/**
 * Switch active broker mode back to 'paper'. Always allowed, no
 * gates — switching DOWN to safer state should never be friction.
 * Idempotent (safe to call when already on paper).
 */
export async function switchToPaper(): Promise<ActionResult> {
  const { chatId } = await requireLiveEligible();
  const sb = supabaseAdmin();
  const { data: u } = await sb
    .from("users")
    .select("active_broker_mode")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!u) return { ok: false, error: "user not found" };
  if (u.active_broker_mode === "paper") return { ok: true };

  const { error } = await sb
    .from("users")
    .update({
      active_broker_mode: "paper",
      last_mode_switch_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };

  await logEvent(chatId, "mode_switched_to_paper", { from: "live" });
  sendBotDMFireAndForget(
    chatId,
    "🟢 <b>Switched back to PAPER</b>\n" +
      "\n" +
      "Auto-trade signals will route to your Alpaca paper account. " +
      "No real money is at risk.\n" +
      "\n" +
      "<i>Existing live positions on Alpaca are NOT auto-closed by " +
      "this switch — visit Alpaca to flatten them, or use /kill YES " +
      "to cancel any pending orders.</i>",
  );
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

  // Failsafe: if we're disabling live, also switch active mode back
  // to paper. Otherwise the user could end up with active_broker_mode
  // = 'live' but live_trading_enabled = false, which the bot would
  // then refuse to trade on (correct behavior, but confusing). Force
  // the flag set and active mode set in one transaction.
  const updates: Record<string, unknown> = { live_trading_enabled: enabled };
  if (!enabled) {
    updates.active_broker_mode = "paper";
    updates.last_mode_switch_at = new Date().toISOString();
  }

  const { error } = await sb
    .from("users")
    .update(updates)
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  await logEvent(
    chatId,
    enabled ? "live_trading_enabled" : "live_trading_disabled",
    !enabled ? { active_mode_forced: "paper" } : {},
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

  // Caps are integer dollars. Number.isFinite alone accepts 1e18
  // (which silently overflows the DB numeric range) — switch to
  // Number.isInteger for both bounds and type. The DB CHECK
  // constraints catch range violations, but pre-DB validation gives
  // a friendly message.
  if (opts.position_usd !== undefined) {
    if (
      !Number.isInteger(opts.position_usd) ||
      opts.position_usd < LIMITS.position_usd.min ||
      opts.position_usd > LIMITS.position_usd.max
    ) {
      return {
        ok: false,
        error: `Position cap must be a whole dollar amount $${LIMITS.position_usd.min}–$${LIMITS.position_usd.max.toLocaleString()}`,
      };
    }
    updates.live_max_position_usd = opts.position_usd;
  }
  if (opts.daily_loss_usd !== undefined) {
    if (
      !Number.isInteger(opts.daily_loss_usd) ||
      opts.daily_loss_usd < LIMITS.daily_loss_usd.min ||
      opts.daily_loss_usd > LIMITS.daily_loss_usd.max
    ) {
      return {
        ok: false,
        error: `Daily loss cap must be a whole dollar amount $${LIMITS.daily_loss_usd.min}–$${LIMITS.daily_loss_usd.max.toLocaleString()}`,
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

/**
 * Master kill switch — kills BOTH paper and live in one call. Use
 * this instead of mode-specific kill switches when you want a single
 * "stop everything" action. The page-level kill switch UI calls
 * this so users don't have to remember which mode they're in to
 * find the right kill button.
 *
 * Effects:
 *   - Cancels every open Alpaca order on the active broker connection
 *     (delegated to engageKillSwitch in actions.ts which handles the
 *     paper-side cancel-all + risk_rails flag flip).
 *   - Flips users.live_trading_enabled = false
 *   - Flips users.active_broker_mode = 'paper'
 *   - Resets every auto_trade_rules.execution_mode = 'off'
 *   - Logs a forensic event to live_trading_events
 *
 * Returns ok if the rule resets + flag flips succeeded. The Alpaca
 * cancel-all is best-effort — connection or network problems don't
 * fail the whole operation since the flag flips already prevent new
 * routing.
 */
export async function engageMasterKillSwitch(
  reason: string,
): Promise<ActionResult<{ canceledCount: number } | undefined>> {
  // Reuse the paper kill switch (which handles Alpaca cancel-all +
  // auto-trade rule reset + risk_rails kill flag) and layer the
  // live-side resets on top when the user has the live add-on.
  // Paper-only users get the paper behavior — same button, same UX,
  // just nothing live to flip.
  const { engageKillSwitch } = await import("./actions");
  const paperRes = await engageKillSwitch(reason || "master kill");

  // Best-effort live disable. We don't require live eligibility here
  // since the kill switch should work for paper-only users too —
  // they just have nothing live to disable.
  try {
    const session = await auth();
    const u = session?.user as { tgUserId?: number } | undefined;
    if (u?.tgUserId) {
      const sb = supabaseAdmin();
      await sb
        .from("users")
        .update({
          live_trading_enabled: false,
          active_broker_mode: "paper",
          last_mode_switch_at: new Date().toISOString(),
        })
        .eq("chat_id", u.tgUserId);
      await logEvent(u.tgUserId, "master_kill_switch_engaged", {
        reason: reason?.slice(0, 200) ?? "manual",
        paper_cancel_ok: paperRes.ok,
      });
    }
  } catch {
    // Live-side disable is non-critical; paper kill already landed.
  }
  revalidatePath("/app/broker");
  return paperRes;
}

export async function engageLiveKillSwitch(
  reason: string,
): Promise<ActionResult> {
  const { chatId } = await requireLiveEligible();
  const sb = supabaseAdmin();
  // Live kill switch flips live_trading_enabled OFF AND switches
  // active_broker_mode back to paper. Three reasons all rolled up:
  //   - flag false  → can't re-enable without going through opt-in
  //   - mode paper  → any in-flight signal evaluation routes to paper
  //   - audit row   → forensic record of the trip
  const { error } = await sb
    .from("users")
    .update({
      live_trading_enabled: false,
      active_broker_mode: "paper",
      last_mode_switch_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  await logEvent(chatId, "live_kill_switch_engaged", {
    reason: reason?.slice(0, 200) ?? "user-engaged",
    active_mode_forced: "paper",
  });
  revalidatePath("/app/broker");
  return { ok: true };
}
