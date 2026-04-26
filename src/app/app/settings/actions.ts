"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Settings server actions — straight column writes against
// public.users. The bot's _user_sync_loop polls the same row every
// 60s, so changes here propagate to the running bot within a minute
// without any explicit IPC. No web-only state, no separate cache to
// invalidate; Supabase is the single source of truth.
//
// Validation philosophy: we mirror the bot's check constraints + enum
// lists so a value rejected here would also be rejected by Telegram
// commands, keeping the rules in lockstep. If the schema or strategy
// list ever changes, both sides will drift together if we forget to
// update this file — the smoke test should catch that.

type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_RISK_PROFILES = [
  "conservative",
  "moderate",
  "aggressive",
] as const;

// Mirrors scanner/strategies.py STRATEGIES tuple. If new strategies
// land in the bot, add them here too.
const VALID_STRATEGIES = [
  "balanced",
  "momentum_breakouts",
  "mean_reversion",
  "trend_following",
  "post_earnings_drift",
  "high_conviction",
] as const;

// Min-share-price tiers that map cleanly to the bot's penny-stock
// policy. Free-form input would let users type 2.50 etc., but the
// three-tier default matches how /setprice surfaces it on Telegram
// and avoids confusion ("why does $4 work but $4.99 silently get
// rounded?"). Users who need precision can still set arbitrary
// values via /setprice.
const ALLOWED_MIN_PRICES = [0, 1, 5] as const;

// Format gate — must be 1-5 letters with optional .X share-class
// suffix. Tighter than before so obvious gibberish (1+ digits, weird
// punctuation) gets rejected at the format layer before we even hit
// Yahoo. BRK.B / GOOG.A / RDS.A type symbols still pass.
const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;

const WATCHLIST_MAX = 50;

// In-memory validation cache. Yahoo is generous but we still
// shouldn't hammer it for repeat lookups (e.g. user adds AAPL,
// removes it, adds again). Lives for the life of the server process,
// which is fine — tickers don't get delisted often enough to matter.
const _validatedTickers = new Map<string, boolean>();

// Verify a ticker actually trades by hitting Yahoo's public chart
// endpoint. Cheap, no auth, returns 404 (or empty result array) for
// unknown symbols. We fail-OPEN on network errors / timeouts so a
// transient outage doesn't block the user; the bot will simply ignore
// any garbage that slips through when scanning.
async function isRealTicker(ticker: string): Promise<boolean> {
  if (_validatedTickers.has(ticker)) return _validatedTickers.get(ticker)!;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        signal: ctrl.signal,
        // Yahoo blocks non-browser UAs sporadically; spoof a generic one.
        headers: { "User-Agent": "Mozilla/5.0 EdgeNiq/1.0" },
      },
    );
    clearTimeout(t);
    if (!res.ok) {
      // 404 specifically means symbol doesn't exist; cache the
      // negative result. Other errors (5xx, rate limit) — fail open.
      if (res.status === 404) {
        _validatedTickers.set(ticker, false);
        return false;
      }
      return true;
    }
    const json = (await res.json()) as {
      chart?: { result?: unknown[] | null; error?: { code?: string } };
    };
    const ok = !!json.chart?.result?.length && !json.chart?.error;
    _validatedTickers.set(ticker, ok);
    return ok;
  } catch {
    // Network error / abort — fail open.
    return true;
  }
}

async function requireUser(): Promise<{ chatId: number }> {
  const session = await auth();
  const user = session?.user as { tgUserId?: number } | undefined;
  if (!user?.tgUserId) throw new Error("unauthorized");
  return { chatId: user.tgUserId };
}

export async function updateRiskProfile(value: string): Promise<ActionResult> {
  try {
    const { chatId } = await requireUser();
    if (!VALID_RISK_PROFILES.includes(value as never)) {
      return { ok: false, error: "Invalid risk profile" };
    }
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("users")
      .update({ risk_profile: value })
      .eq("chat_id", chatId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app/settings");
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateStrategy(value: string): Promise<ActionResult> {
  try {
    const { chatId } = await requireUser();
    if (!VALID_STRATEGIES.includes(value as never)) {
      return { ok: false, error: "Invalid strategy" };
    }
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("users")
      .update({ strategy: value })
      .eq("chat_id", chatId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app/settings");
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateMinPrice(value: number): Promise<ActionResult> {
  try {
    const { chatId } = await requireUser();
    if (!ALLOWED_MIN_PRICES.includes(value as never)) {
      return { ok: false, error: "Invalid min price tier" };
    }
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("users")
      .update({ min_price: value })
      .eq("chat_id", chatId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Watchlist add/remove writes the full new array back. Last-write-wins
// is fine — concurrent edits to the same user's watchlist between web
// and Telegram are vanishingly rare (single user, two surfaces) and
// the worst case is one ticker getting re-added or re-removed.
export async function addWatchlistTicker(raw: string): Promise<ActionResult> {
  try {
    const { chatId } = await requireUser();
    const ticker = raw.trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) {
      return {
        ok: false,
        error: "Ticker must be 1-5 letters (optionally .X for share class)",
      };
    }
    // Real-ticker check before we touch the DB — keeps garbage like
    // AAAA / XXXX out of users.watchlist where the bot's scanner would
    // silently ignore them and confuse anyone reading the table.
    const isReal = await isRealTicker(ticker);
    if (!isReal) {
      return { ok: false, error: `${ticker} is not a recognized ticker` };
    }
    const sb = supabaseAdmin();
    const { data: row } = await sb
      .from("users")
      .select("watchlist")
      .eq("chat_id", chatId)
      .single();
    const existing: string[] = Array.isArray(row?.watchlist)
      ? row!.watchlist
      : [];
    if (existing.length >= WATCHLIST_MAX) {
      return { ok: false, error: `Watchlist is at the max of ${WATCHLIST_MAX}` };
    }
    if (existing.includes(ticker)) {
      return { ok: true };
    }
    const next = [...existing, ticker];
    const { error } = await sb
      .from("users")
      .update({ watchlist: next })
      .eq("chat_id", chatId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app/settings");
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeWatchlistTicker(raw: string): Promise<ActionResult> {
  try {
    const { chatId } = await requireUser();
    const ticker = raw.trim().toUpperCase();
    if (!ticker) return { ok: false, error: "Empty ticker" };
    const sb = supabaseAdmin();
    const { data: row } = await sb
      .from("users")
      .select("watchlist")
      .eq("chat_id", chatId)
      .single();
    const existing: string[] = Array.isArray(row?.watchlist)
      ? row!.watchlist
      : [];
    const next = existing.filter((t) => t.toUpperCase() !== ticker);
    if (next.length === existing.length) {
      // Already gone — idempotent.
      return { ok: true };
    }
    const { error } = await sb
      .from("users")
      .update({ watchlist: next })
      .eq("chat_id", chatId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app/settings");
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
