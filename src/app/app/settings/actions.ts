"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { watchlistCapFromRow } from "@/lib/watchlist-caps";

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

// Reserved-word denylist. Defense-in-depth — Supabase queries are
// parameterized so SQL injection isn't possible today, but a future
// developer interpolating a ticker into a raw SQL string (or
// reflecting it into another system that does) would have a free
// keyword injection. Cheap to block at the input boundary.
const RESERVED_TICKERS = new Set([
  "NULL",
  "TRUE",
  "FALSE",
  "AND",
  "OR",
  "NOT",
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "UNION",
]);

// Per-tier watchlist caps live in @/lib/watchlist-caps so they can be
// imported from both server actions ("use server", async-exports
// only) and server components. The lookup wrapper here just hits
// Supabase for the row and delegates to the pure mapping.
async function watchlistCapForUser(chatId: number): Promise<number> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("users")
    .select("sub_plan, sub_status, role")
    .eq("chat_id", chatId)
    .maybeSingle();
  return watchlistCapFromRow({
    role: (data?.role as string | undefined) ?? undefined,
    subPlan: (data?.sub_plan as string | undefined) ?? undefined,
    subStatus: (data?.sub_status as string | undefined) ?? undefined,
  });
}

// In-memory validation cache. Yahoo is generous but we still
// shouldn't hammer it for repeat lookups (e.g. user adds AAPL,
// removes it, adds again). Lives for the life of the server process,
// which is fine — tickers don't get delisted often enough to matter.
const _validatedTickers = new Map<string, boolean>();

// Verify a ticker actually trades by hitting Yahoo's public search
// endpoint. The chart endpoint we tried first (v8/finance/chart) was
// too permissive — it returns 200 with placeholder shape for some
// non-existent strings like XXXX. The search endpoint is stricter:
// returns the actual quote universe Yahoo knows about, and we then
// require an EXACT symbol match in the results (Yahoo's search is
// fuzzy by default, so without exact-match we'd accept anything that
// shares a prefix with a real ticker).
//
// Fail-OPEN on network/timeout so a transient outage doesn't block
// legit adds; the bot scanner will simply ignore any garbage that
// slips through.
async function isRealTicker(ticker: string): Promise<boolean> {
  if (_validatedTickers.has(ticker)) return _validatedTickers.get(ticker)!;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=10&newsCount=0`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      // Yahoo intermittently blocks non-browser UAs.
      headers: { "User-Agent": "Mozilla/5.0 EdgeNiq/1.0" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return true; // fail open on HTTP error
    const json = (await res.json()) as {
      quotes?: Array<{ symbol?: string; quoteType?: string }>;
    };
    const quotes = json.quotes ?? [];
    // Exact symbol match — Yahoo's search returns fuzzy matches by
    // default (e.g. searching "AAP" surfaces AAPL). We don't want
    // that. The user typed exactly this string; only accept if a
    // tradable instrument exists with that exact symbol.
    const match = quotes.some(
      (q) => (q.symbol ?? "").toUpperCase() === ticker,
    );
    _validatedTickers.set(ticker, match);
    return match;
  } catch {
    return true; // fail open on network error / abort
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
    if (!TICKER_RE.test(ticker) || RESERVED_TICKERS.has(ticker)) {
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
    const cap = await watchlistCapForUser(chatId);
    if (existing.length >= cap) {
      return {
        ok: false,
        error: `Watchlist is at your tier cap of ${cap} tickers. Upgrade for more.`,
      };
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
