"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { encrypt, type EncryptedBlob } from "@/lib/crypto";
import { AlpacaClient, AlpacaError, testConnection } from "@/lib/alpaca";

// Server actions for /app/broker. All actions re-verify the session
// and enforce the Elite-tier gate server-side — never rely on the
// client to have filtered UI correctly.

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function requireElite(): Promise<number> {
  const session = await auth();
  const user = session?.user as
    | { tgUserId?: number; role?: string; subPlan?: string }
    | undefined;
  if (!user?.tgUserId) throw new Error("unauthorized");
  // Admin bypass matches bot-side has_elite_access.
  const isAdmin = user.role === "admin" || user.role === "primary_admin";
  if (isAdmin) return user.tgUserId;
  // Trial and Elite both count as Elite-access.
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("users")
    .select("sub_plan, sub_status")
    .eq("chat_id", user.tgUserId)
    .maybeSingle();
  if (!data) throw new Error("user not found");
  const status = (data.sub_status ?? "").toLowerCase();
  const plan = (data.sub_plan ?? "").toLowerCase();
  const eliteish = status === "trial" || plan === "elite";
  if (!eliteish) {
    throw new Error(
      "Auto-trading is an Elite feature. Contact admin to upgrade.",
    );
  }
  return user.tgUserId;
}

// ----------------------------------------------------------------------
// Connection management
// ----------------------------------------------------------------------

export async function testAlpacaConnection(
  apiKey: string,
  apiSecret: string,
): Promise<ActionResult<{ accountId: string; buyingPower: string; status: string }>> {
  await requireElite();
  if (!apiKey?.trim() || !apiSecret?.trim()) {
    return { ok: false, error: "API key and secret are required" };
  }
  try {
    // Paper only for now.
    const account = await testConnection(apiKey.trim(), apiSecret.trim(), "paper");
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
            "Alpaca rejected the key/secret. Double-check you pasted a paper-trading key (not live).",
        };
      }
      return { ok: false, error: `Alpaca ${exc.status} — check the key and try again.` };
    }
    return {
      ok: false,
      error: exc instanceof Error ? exc.message : "Unknown error",
    };
  }
}

export async function saveAlpacaConnection(
  apiKey: string,
  apiSecret: string,
): Promise<ActionResult> {
  const chatId = await requireElite();
  if (!apiKey?.trim() || !apiSecret?.trim()) {
    return { ok: false, error: "API key and secret are required" };
  }
  const cleanKey = apiKey.trim();
  const cleanSecret = apiSecret.trim();

  // Always test before saving — no point persisting credentials that
  // Alpaca doesn't recognize. Returns a concrete error the caller can
  // surface inline.
  let account;
  try {
    account = await testConnection(cleanKey, cleanSecret, "paper");
  } catch (exc) {
    if (exc instanceof AlpacaError && (exc.status === 401 || exc.status === 403)) {
      return {
        ok: false,
        error:
          "Alpaca rejected the key/secret. Double-check you pasted a paper-trading key (not live).",
      };
    }
    return {
      ok: false,
      error: exc instanceof Error ? exc.message : "Alpaca test failed",
    };
  }

  const encKey: EncryptedBlob = encrypt(cleanKey);
  const encSecret: EncryptedBlob = encrypt(cleanSecret);

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("broker_connections")
    .upsert(
      {
        chat_id: chatId,
        broker: "alpaca",
        mode: "paper",
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
      // Conflict key includes mode after the live-mode migration —
      // (chat_id, broker, mode) is unique so paper + live can coexist.
      { onConflict: "chat_id,broker,mode" },
    );
  if (error) return { ok: false, error: error.message };

  // Seed default rules + risk rails on first connect so the user has
  // a sane baseline to edit (all rules default to execution_mode='off',
  // which means nothing auto-fires until they opt in). Seed BOTH
  // paper and live rows so the Live tab is populated when the user
  // first opts into live — no race where Live shows empty rules.
  await supabase
    .from("auto_trade_rules")
    .upsert(
      [
        { chat_id: chatId, signal_type: "stocks", mode: "paper" },
        { chat_id: chatId, signal_type: "options", mode: "paper" },
        { chat_id: chatId, signal_type: "stocks", mode: "live" },
        { chat_id: chatId, signal_type: "options", mode: "live" },
      ],
      {
        onConflict: "chat_id,signal_type,mode",
        ignoreDuplicates: true,
      },
    );
  await supabase
    .from("auto_trade_risk_rails")
    .upsert(
      { chat_id: chatId },
      { onConflict: "chat_id", ignoreDuplicates: true },
    );
  revalidatePath("/app/broker");
  return { ok: true };
}

export async function disconnectBroker(): Promise<ActionResult> {
  const chatId = await requireElite();
  const supabase = supabaseAdmin();
  // Scoped to mode='paper' so disconnecting your paper account
  // doesn't accidentally tear down a live connection too. Live has
  // its own disconnect action in live-actions.ts.
  const { error } = await supabase
    .from("broker_connections")
    .update({ is_active: false })
    .eq("chat_id", chatId)
    .eq("broker", "alpaca")
    .eq("mode", "paper");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/broker");
  return { ok: true };
}

// ----------------------------------------------------------------------
// Rules + risk rails
// ----------------------------------------------------------------------

export type RulesUpdate = {
  signalType: "stocks" | "options";
  mode: "paper" | "live";
  executionMode: "off" | "one_tap" | "auto";
  minScore: number;
  watchlistOnly: boolean;
  positionSizeType: "dollar_fixed" | "pct_buying_power" | "share_fixed" | "atr_based";
  positionSizeValue: number;
  maxDailyOrders: number;
  cooldownMinutes: number;
  // Optional exit-strategy overrides. Pass null to clear (use the
  // default for this signal type — signal-defined for stocks,
  // risk-profile preset for options).
  targetPct: number | null;
  stopPct: number | null;
};

export async function updateRules(upd: RulesUpdate): Promise<ActionResult> {
  const chatId = await requireElite();
  if (upd.mode !== "paper" && upd.mode !== "live") {
    return { ok: false, error: "invalid mode" };
  }
  if (upd.minScore < 50 || upd.minScore > 100) {
    return { ok: false, error: "min score must be between 50 and 100" };
  }
  if (upd.positionSizeValue <= 0) {
    return { ok: false, error: "position size must be positive" };
  }
  if (upd.maxDailyOrders < 0 || upd.maxDailyOrders > 100) {
    return { ok: false, error: "max daily orders must be between 0 and 100" };
  }
  // Mirror the DB-side check constraints — fail fast with a friendly
  // message rather than letting Postgres throw a generic violation.
  if (upd.targetPct !== null && (upd.targetPct <= 0 || upd.targetPct > 500)) {
    return { ok: false, error: "Target % override must be between 0 and 500" };
  }
  if (upd.stopPct !== null && (upd.stopPct <= 0 || upd.stopPct > 90)) {
    return { ok: false, error: "Stop % override must be between 0 and 90" };
  }
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("auto_trade_rules")
    .upsert(
      {
        chat_id: chatId,
        signal_type: upd.signalType,
        mode: upd.mode,
        execution_mode: upd.executionMode,
        min_score: upd.minScore,
        watchlist_only: upd.watchlistOnly,
        position_size_type: upd.positionSizeType,
        position_size_value: upd.positionSizeValue,
        max_daily_orders: upd.maxDailyOrders,
        cooldown_minutes: upd.cooldownMinutes,
        target_pct: upd.targetPct,
        stop_pct: upd.stopPct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chat_id,signal_type,mode" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/broker");
  return { ok: true };
}

export type RiskRailsUpdate = {
  maxOpenPositions: number;
  maxAllocPerTickerPct: number;
  maxDailyLossUsd: number | null;
  maxDailyLossPct: number | null;
};

export async function updateRiskRails(
  upd: RiskRailsUpdate,
): Promise<ActionResult> {
  const chatId = await requireElite();
  if (upd.maxOpenPositions < 1 || upd.maxOpenPositions > 100) {
    return { ok: false, error: "max open positions must be between 1 and 100" };
  }
  if (upd.maxAllocPerTickerPct <= 0 || upd.maxAllocPerTickerPct > 100) {
    return { ok: false, error: "max alloc % must be between 0 and 100" };
  }
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("auto_trade_risk_rails")
    .upsert(
      {
        chat_id: chatId,
        max_open_positions: upd.maxOpenPositions,
        max_alloc_per_ticker_pct: upd.maxAllocPerTickerPct,
        max_daily_loss_usd: upd.maxDailyLossUsd,
        max_daily_loss_pct: upd.maxDailyLossPct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chat_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/broker");
  return { ok: true };
}

// ----------------------------------------------------------------------
// Kill switch
// ----------------------------------------------------------------------

// Master "auto-trade on/off" switch. Batch-sets execution_mode on
// every auto_trade_rules row for this user IN ONE MODE. Caller
// passes the mode of the tab they're on so toggling Paper auto-trade
// doesn't silently flip Live rules (and vice versa). Each tab has
// its own rules — that mutex is the whole point of the per-mode
// rule architecture.
export async function setMasterAutoTrade(
  enabled: boolean,
  mode: "paper" | "live",
): Promise<ActionResult> {
  const chatId = await requireElite();
  if (mode !== "paper" && mode !== "live") {
    return { ok: false, error: "invalid mode" };
  }
  const supabase = supabaseAdmin();
  // When enabling, flip OFF rules to 'auto'. Rules already on
  // 'one_tap' stay on one_tap so we don't steamroll someone's
  // more-deliberate mode. When disabling, everything goes to 'off'.
  if (enabled) {
    const { error } = await supabase
      .from("auto_trade_rules")
      .update({ execution_mode: "auto", updated_at: new Date().toISOString() })
      .eq("chat_id", chatId)
      .eq("mode", mode)
      .eq("execution_mode", "off");
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("auto_trade_rules")
      .update({ execution_mode: "off", updated_at: new Date().toISOString() })
      .eq("chat_id", chatId)
      .eq("mode", mode);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/app/broker");
  return { ok: true };
}

export async function engageKillSwitch(
  reason: string = "manual",
): Promise<ActionResult<{ canceledCount: number }>> {
  const chatId = await requireElite();
  const supabase = supabaseAdmin();

  // Flip kill switch first so new orders get blocked immediately even
  // if cancellation fails partially.
  const { error: railsErr } = await supabase
    .from("auto_trade_risk_rails")
    .upsert(
      {
        chat_id: chatId,
        kill_switch_engaged: true,
        kill_switch_engaged_at: new Date().toISOString(),
        kill_switch_engaged_reason: reason,
      },
      { onConflict: "chat_id" },
    );
  if (railsErr) return { ok: false, error: railsErr.message };

  // Also turn OFF all execution modes so the user doesn't keep the
  // switch armed-but-running after re-enabling.
  await supabase
    .from("auto_trade_rules")
    .update({ execution_mode: "off", updated_at: new Date().toISOString() })
    .eq("chat_id", chatId);

  // Cancel all open Alpaca orders. If we can't read the connection
  // (user disconnected), skip — the rails flip alone is enough to
  // stop future orders.
  let canceledCount = 0;
  try {
    const { decrypt } = await import("@/lib/crypto");
    const { data: conn } = await supabase
      .from("broker_connections")
      .select("encrypted_api_key, encrypted_api_secret, mode")
      .eq("chat_id", chatId)
      .eq("broker", "alpaca")
      .eq("is_active", true)
      .maybeSingle();
    if (conn) {
      const apiKey = decrypt(conn.encrypted_api_key as EncryptedBlob);
      const apiSecret = decrypt(conn.encrypted_api_secret as EncryptedBlob);
      const client = new AlpacaClient(apiKey, apiSecret, conn.mode as "paper");
      await client.cancelAllOrders();
      canceledCount = 1; // Alpaca returns 207 without a precise count; boolean suffices
    }
  } catch (exc) {
    // Don't fail the whole kill-switch because Alpaca cancel-all errored.
    // The rails flip has already stopped new orders. Log for the admin.
    console.error("kill switch: cancel-all failed (rails still engaged)", exc);
  }

  revalidatePath("/app/broker");
  return { ok: true, data: { canceledCount } };
}

export async function releaseKillSwitch(): Promise<ActionResult> {
  const chatId = await requireElite();
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("auto_trade_risk_rails")
    .update({
      kill_switch_engaged: false,
      kill_switch_engaged_at: null,
      kill_switch_engaged_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/broker");
  return { ok: true };
}
