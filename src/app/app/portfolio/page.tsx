import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HeaderStat } from "@/components/header-stat";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AlpacaClient } from "@/lib/alpaca";
import { decrypt, type EncryptedBlob } from "@/lib/crypto";
import { formatSymbol, formatSymbolLong } from "@/lib/options-format";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDashed,
  Clock,
  Target as TargetIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Portfolio — confirmed personal trades, active + recent closed.
// Active cards show live Alpaca price (when the user is broker-connected),
// the target ladder vs entry, stop position, and signal-fire context
// joined from the canonical trades table via signal_id.

type PersonalTarget = {
  price: number;
  pct: number;
  sell?: string;
  hit?: boolean;
  hit_at?: string | null;
};
type PersonalStop = {
  price: number;
  pct: number;
  moved_to_entry?: boolean;
};

type PersonalTradeRow = {
  personal_trade_id: string;
  signal_id: string;
  ticker: string;
  user_entry_price: number;
  confirmed_at: string;
  risk_profile: string;
  personal_targets: Record<string, PersonalTarget> | null;
  personal_stop: PersonalStop | null;
  status: "active" | "closed";
  outcome: string | null;
  closed_at: string | null;
  user_pnl_pct: number | null;
  close_reason: string | null;
};

type SignalContext = {
  trade_id: string;
  suggested_at: string;
  suggested_price: number;
  signal_grade: string;
  signal_type: string;
  volatility_regime?: string | null;
};

type EnrichedTrade = PersonalTradeRow & {
  signal?: SignalContext;
  livePrice?: number | null;
};

// Options trades — separate table from personal_trades because the
// schema is contract-specific (OPRA symbol, strike, expiry, side).
// Confirmed via the "Did you enter this options trade?" Telegram
// follow-up.
type PersonalOptionsTradeRow = {
  personal_options_trade_id: string;
  symbol: string;
  underlying: string;
  side: "call" | "put";
  strike: number;
  expiry: string;
  contracts: number;
  user_entry_price: number;
  underlying_price_at_entry: number;
  confirmed_at: string;
  personal_target_price: number;
  personal_stop_price: number;
  status: "active" | "closed";
  outcome: string | null;
  closed_at: string | null;
  closed_option_price: number | null;
  user_pnl_pct: number | null;
};

export default async function PortfolioPage() {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)?.tgUserId;
  if (!tgUserId) return null;

  const db = supabaseAdmin();

  // Base portfolio query.
  const { data: tradeRows } = await db
    .from("personal_trades")
    .select(
      "personal_trade_id, signal_id, ticker, user_entry_price, confirmed_at, risk_profile, personal_targets, personal_stop, status, outcome, closed_at, user_pnl_pct, close_reason",
    )
    .eq("chat_id", tgUserId)
    .order("confirmed_at", { ascending: false })
    .limit(50);

  const trades = (tradeRows ?? []) as PersonalTradeRow[];

  // Confirmed options trades — separate table from personal_trades.
  // Limited to 50 most recent (active + closed) so the page stays
  // bounded for power users.
  const { data: optTradeRows } = await db
    .from("personal_options_trades")
    .select(
      "personal_options_trade_id, symbol, underlying, side, strike, expiry, contracts, user_entry_price, underlying_price_at_entry, confirmed_at, personal_target_price, personal_stop_price, status, outcome, closed_at, closed_option_price, user_pnl_pct",
    )
    .eq("chat_id", tgUserId)
    .order("confirmed_at", { ascending: false })
    .limit(50);
  const optionsTrades = (optTradeRows ?? []) as PersonalOptionsTradeRow[];
  const activeOptions = optionsTrades.filter((t) => t.status === "active");
  const closedOptions = optionsTrades.filter((t) => t.status === "closed");

  // Auto-traded orders the bot submitted to Alpaca on the user's
  // behalf. Distinct from personal_trades / personal_options_trades:
  // those require explicit user confirmation (/confirm or "I entered"
  // button); auto_trades are submitted by the rules engine without a
  // per-signal tap. Without surfacing them here, a user with auto-
  // trade ON would see "no portfolio activity" while their Alpaca
  // dashboard shows real fills — confusing AND a real-money risk
  // (you can't manage what you can't see). Limited to today + last
  // 30 days closed so the page doesn't unbounded-scroll for active
  // bots.
  type AutoTradeRow = {
    id: string;
    symbol: string;
    side: string;
    qty: number;
    status: string;
    avg_fill_price: number | null;
    submitted_at: string;
    filled_at: string | null;
    order_class: string | null;
    mode: string;
    error_message: string | null;
  };
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);
  const { data: autoTradeRows } = await db
    .from("auto_trades")
    .select(
      "id, symbol, side, qty, status, avg_fill_price, submitted_at, filled_at, order_class, mode, error_message",
    )
    .eq("chat_id", tgUserId)
    .gte("submitted_at", since30d.toISOString())
    // Show every status except known-failures. The bot writes
    // Alpaca's INITIAL response status (usually "accepted") and
    // doesn't go back to update the row when the order actually
    // fills — so an earlier filter of status='filled' missed every
    // real position. Inclusive filter (NOT IN failure states)
    // captures the user's actual exposure regardless of whether
    // the row's status field is stale.
    .not("status", "in", '("rejected","canceled","expired")')
    .order("submitted_at", { ascending: false })
    .limit(50);
  const autoTrades = (autoTradeRows ?? []) as AutoTradeRow[];

  // Join signal context in a single IN query so we don't fan out one
  // request per trade. Grade/type/regime improve the entry narrative.
  const signalIds = Array.from(
    new Set(trades.map((t) => t.signal_id).filter(Boolean)),
  );
  let signalsById = new Map<string, SignalContext>();
  if (signalIds.length > 0) {
    const { data: sigRows } = await db
      .from("trades")
      .select(
        "trade_id, suggested_at, suggested_price, signal_grade, signal_type, volatility_regime",
      )
      .in("trade_id", signalIds);
    signalsById = new Map(
      (sigRows ?? []).map((r) => [r.trade_id as string, r as SignalContext]),
    );
  }

  // Live price only for active trades, and only when the user has a
  // working Alpaca connection. Non-connected users still get the full
  // entry/target/stop/signal view — just no current-price column.
  const active = trades.filter((t) => t.status === "active");
  const closed = trades.filter((t) => t.status === "closed");

  const livePrices = await fetchLivePricesForActive(
    tgUserId,
    active.map((t) => t.ticker),
  );

  const activeEnriched: EnrichedTrade[] = active.map((t) => ({
    ...t,
    signal: signalsById.get(t.signal_id),
    livePrice: livePrices.get(t.ticker) ?? null,
  }));
  const closedEnriched: EnrichedTrade[] = closed.map((t) => ({
    ...t,
    signal: signalsById.get(t.signal_id),
  }));

  // Header right-side summary. Live unrealized = current price vs
  // entry, weighted equally per position (no allocation data here, so
  // we can't dollar-weight). Closed P&L = mean of user_pnl_pct on
  // recently-closed rows. Both are filler stats designed to make the
  // top of the page useful, not strictly accurate portfolio math.
  const liveUnrealized = (() => {
    const items = activeEnriched
      .filter((t) => t.livePrice && t.user_entry_price > 0)
      .map(
        (t) => ((t.livePrice ?? 0) - t.user_entry_price) / t.user_entry_price,
      );
    if (items.length === 0) return null;
    return (items.reduce((s, x) => s + x, 0) / items.length) * 100;
  })();
  const closedAvgPnl =
    closed.length > 0
      ? closed.reduce((s, t) => s + (t.user_pnl_pct ?? 0), 0) / closed.length
      : null;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.69_0.16_165_/_0.6)]" />
            Positions
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            Your confirmed personal trades. Active positions show live
            progress toward targets and stop; closed show the final P&amp;L
            and how they exited.
          </p>
        </div>
        <div className="flex flex-wrap items-stretch gap-3">
          <HeaderStat
            label="Active"
            value={`${active.length + activeOptions.length}`}
            sub={
              liveUnrealized != null
                ? `${liveUnrealized >= 0 ? "+" : ""}${liveUnrealized.toFixed(2)}% live`
                : activeOptions.length > 0
                  ? `${active.length} stk · ${activeOptions.length} opt`
                  : "—"
            }
            tone={
              liveUnrealized == null
                ? "muted"
                : liveUnrealized >= 0
                  ? "emerald"
                  : "rose"
            }
          />
          <HeaderStat
            label="Closed"
            value={`${closed.length + closedOptions.length}`}
            sub={
              closedAvgPnl != null
                ? `${closedAvgPnl >= 0 ? "+" : ""}${closedAvgPnl.toFixed(2)}% avg`
                : "—"
            }
            tone={
              closedAvgPnl == null
                ? "muted"
                : closedAvgPnl >= 0
                  ? "emerald"
                  : "rose"
            }
          />
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Active stocks
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {activeEnriched.length}{" "}
            {activeEnriched.length === 1 ? "position" : "positions"}
          </span>
        </div>
        {activeEnriched.length === 0 ? (
          <Card className="p-8 border-border/60 bg-card/50 text-center">
            <p className="text-sm text-muted-foreground">
              No active stock trades. Confirm a signal from Telegram and
              it will show up here.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {activeEnriched.map((t) => (
              <ActiveTradeCard key={t.personal_trade_id} trade={t} />
            ))}
          </div>
        )}
      </section>

      {/* Options trades — separate section because the schema is
          contract-specific (OPRA symbol, strike, expiry, side) and
          the card layout differs from stocks. Active options surface
          their target/stop premium thresholds; closed options show
          the realized P&L on premium. */}
      {(activeOptions.length > 0 || closedOptions.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Options
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {activeOptions.length}{" "}
              {activeOptions.length === 1 ? "active" : "active"}
              {closedOptions.length > 0 && ` · ${closedOptions.length} closed`}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug max-w-3xl">
            Premium-based progress for options is intentionally not
            shown as a stock-style bar — theta decay and IV crush mean
            the premium can move opposite to the underlying, so a
            linear bar would mislead. Days-to-expiry below indicates
            theta pressure: under 7 days = decay accelerates fast.
          </p>
          <Card className="p-0 border-border/60 bg-card/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Contract</th>
                    <th className="px-4 py-2 font-medium">Side</th>
                    <th className="px-4 py-2 font-medium">Strike</th>
                    <th className="px-4 py-2 font-medium">Expiry · DTE</th>
                    <th className="px-4 py-2 font-medium">Entry</th>
                    <th className="px-4 py-2 font-medium">Target</th>
                    <th className="px-4 py-2 font-medium">Stop</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeOptions, ...closedOptions].map((t) => {
                    // Days-to-expiry computed from the contract's
                    // expiry date. Negative when the contract has
                    // already expired (we'd typically have closed_at
                    // populated by then). Color tones mirror theta
                    // pressure: <7d = rose (decay accelerates),
                    // 7-21d = amber (manageable), >21d = muted.
                    const dte = (() => {
                      try {
                        const exp = new Date(`${t.expiry}T16:00:00Z`);
                        const now = new Date();
                        return Math.floor(
                          (exp.getTime() - now.getTime()) /
                            (1000 * 60 * 60 * 24),
                        );
                      } catch {
                        return null;
                      }
                    })();
                    const dteTone =
                      dte == null
                        ? "text-muted-foreground"
                        : dte < 0
                          ? "text-muted-foreground line-through"
                          : dte < 7
                            ? "text-rose-300"
                            : dte < 21
                              ? "text-amber-300"
                              : "text-muted-foreground";
                    return (
                    <tr
                      key={t.personal_options_trade_id}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td
                        className="px-5 py-2.5 text-xs"
                        title={formatSymbolLong(t.symbol)}
                      >
                        <div className="font-medium">
                          {formatSymbol(t.symbol)}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground/70">
                          {t.symbol}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            t.side === "call"
                              ? "border-emerald-400/40 text-emerald-300 text-[10px] py-0 h-5"
                              : "border-rose-400/40 text-rose-300 text-[10px] py-0 h-5"
                          }
                        >
                          {t.side}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        ${t.strike.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="text-muted-foreground">
                          {t.expiry}
                        </span>
                        {dte != null && (
                          <span className={`ml-2 tabular-nums ${dteTone}`}>
                            · {dte < 0 ? "expired" : `${dte}d`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        ${t.user_entry_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-emerald-300">
                        ${t.personal_target_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-rose-300">
                        ${t.personal_stop_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            t.status === "active"
                              ? "border-primary/40 text-primary text-[10px] py-0 h-5"
                              : "text-[10px] py-0 h-5 text-muted-foreground"
                          }
                        >
                          {t.status === "active"
                            ? "active"
                            : t.outcome ?? "closed"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {t.user_pnl_pct != null ? (
                          <span
                            className={
                              t.user_pnl_pct >= 0
                                ? "text-emerald-400"
                                : "text-destructive"
                            }
                          >
                            {t.user_pnl_pct >= 0 ? "+" : ""}
                            {t.user_pnl_pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* Auto-trade fills — orders the bot submitted that ACTUALLY
          turned into positions (filled or partially_filled). Rejected
          / canceled / pending orders are intentionally NOT shown here
          — they live on /app/broker for debugging what fired. This
          page is "what do I own right now?", not "what did the bot
          attempt today?" */}
      {autoTrades.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Auto-trade fills
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {autoTrades.length} fill{autoTrades.length === 1 ? "" : "s"}
              {" · last 30d"}
            </span>
          </div>
          <Card className="p-0 border-border/60 bg-card/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Symbol</th>
                    <th className="px-4 py-2 font-medium">Side</th>
                    <th className="px-4 py-2 font-medium">Qty</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Fill</th>
                    <th className="px-4 py-2 font-medium">Mode</th>
                    <th className="px-4 py-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {autoTrades.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td
                        className="px-5 py-2.5 text-xs"
                        title={formatSymbolLong(t.symbol)}
                      >
                        <div className="font-medium">
                          {formatSymbol(t.symbol)}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground/70">
                          {t.symbol}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            t.side === "buy"
                              ? "border-emerald-400/40 text-emerald-300 text-[10px] py-0 h-5"
                              : "border-rose-400/40 text-rose-300 text-[10px] py-0 h-5"
                          }
                        >
                          {t.side}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{t.qty}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className="border-emerald-400/40 text-emerald-300 text-[10px] py-0 h-5"
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {t.avg_fill_price != null
                          ? `$${Number(t.avg_fill_price).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 h-5 ${
                            t.mode === "live"
                              ? "border-rose-400/40 text-rose-300"
                              : "border-primary/40 text-primary"
                          }`}
                        >
                          {t.mode}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(
                          /(Z|[+\-]\d{2}:?\d{2})$/.test(t.submitted_at)
                            ? t.submitted_at
                            : `${t.submitted_at}Z`,
                        ).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Recently closed
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {closedEnriched.length}{" "}
            {closedEnriched.length === 1 ? "trade" : "trades"}
          </span>
        </div>
        {closedEnriched.length === 0 ? (
          <Card className="p-8 border-border/60 bg-card/50 text-center">
            <p className="text-sm text-muted-foreground">
              No closed trades yet. When a trade hits a target or
              stop, it will appear here.
            </p>
          </Card>
        ) : (
          <Card className="border-border/60 bg-card/50 divide-y divide-border/40 overflow-hidden">
            {closedEnriched.slice(0, 20).map((t) => (
              <ClosedTradeRow key={t.personal_trade_id} trade={t} />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function ActiveTradeCard({ trade }: { trade: EnrichedTrade }) {
  const entry = Number(trade.user_entry_price) || 0;
  const live = trade.livePrice ?? null;
  const targets = normalizeTargets(trade.personal_targets);
  const stop = trade.personal_stop?.price ?? 0;
  const unrealizedPct = live != null && entry > 0
    ? ((live - entry) / entry) * 100
    : null;

  // Centered "P&L bar": entry sits in the middle. Left half shows the
  // distance to stop (loss zone), right half shows the distance to the
  // farthest target (profit zone). This matches the user's mental
  // model — winners pull the marker right, losers pull it left.
  const hasLadder = stop > 0 && targets.length > 0;
  const ladderMax = targets[targets.length - 1]?.price ?? entry * 1.15;
  // Distance from entry → stop (loss span) and entry → T3 (profit span)
  // as % of entry, used to size the bar's halves and place ticks.
  const lossSpanPct = entry > 0 ? ((entry - stop) / entry) * 100 : 0;
  const profitSpanPct = entry > 0 ? ((ladderMax - entry) / entry) * 100 : 0;
  // % distance to nearest milestones — surfaced as headline stats.
  const distanceToStopPct = live != null && stop > 0
    ? ((live - stop) / live) * 100
    : null;
  const t1Price = targets[0]?.price ?? null;
  const distanceToT1Pct = live != null && t1Price != null
    ? ((t1Price - live) / live) * 100
    : null;

  return (
    <Card className="p-5 border-border/60 bg-card/50 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-md bg-muted/30 border border-border/40 flex items-center justify-center shrink-0">
            <span className="font-mono text-sm font-semibold">
              {trade.ticker.slice(0, 4)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg tracking-tight">
                {trade.ticker}
              </h3>
              {trade.signal?.signal_grade && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 h-5"
                >
                  Grade {trade.signal.signal_grade}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-5 capitalize"
              >
                {trade.risk_profile}
              </Badge>
              {trade.signal?.volatility_regime && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 h-5 text-muted-foreground capitalize"
                >
                  {trade.signal.volatility_regime} regime
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {prettyType(trade.signal?.signal_type) ?? "Personal trade"}
              {trade.signal?.suggested_at && (
                <>
                  {" "}· signal fired {relativeTime(trade.signal.suggested_at)}
                </>
              )}
            </p>
          </div>
        </div>

        {live != null ? (
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums leading-none">
              ${live.toFixed(2)}
            </div>
            {unrealizedPct != null && (
              <div
                className={`mt-1 inline-flex items-center gap-1 text-xs font-mono tabular-nums ${
                  unrealizedPct >= 0 ? "text-emerald-400" : "text-destructive"
                }`}
              >
                {unrealizedPct >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {unrealizedPct >= 0 ? "+" : ""}
                {unrealizedPct.toFixed(2)}% vs entry
              </div>
            )}
          </div>
        ) : (
          <div className="text-right">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <CircleDashed className="h-3 w-3" />
              live price unavailable
            </div>
            <div className="text-[10px] text-muted-foreground/70 mt-0.5">
              Connect Alpaca for quotes
            </div>
          </div>
        )}
      </div>

      <Separator className="bg-border/40" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Entry"
          value={fmtMoney(entry)}
          subtle={fmtDateShort(trade.confirmed_at)}
        />
        <Stat
          label="Stop"
          value={stop ? fmtMoney(stop) : "—"}
          subtle={
            distanceToStopPct != null
              ? `${distanceToStopPct.toFixed(2)}% room before stop`
              : stop && entry
                ? `${((stop - entry) / entry * 100).toFixed(2)}% from entry`
                : undefined
          }
          tone="rose"
        />
        <Stat
          label="Next target (T1)"
          value={t1Price ? fmtMoney(t1Price) : "—"}
          subtle={
            distanceToT1Pct != null
              ? distanceToT1Pct <= 0
                ? "T1 reached"
                : `${distanceToT1Pct.toFixed(2)}% to go`
              : t1Price && entry
                ? `+${(((t1Price - entry) / entry) * 100).toFixed(2)}% from entry`
                : undefined
          }
          tone="emerald"
        />
        <Stat
          label="All targets"
          value={
            targets.length
              ? targets.map((_, i) => `T${i + 1}`).join(" · ")
              : "—"
          }
          subtle={
            targets.length
              ? targets
                  .map((t) => `+${(t.pct || 0).toFixed(0)}%`)
                  .join(" · ")
              : undefined
          }
          tone="emerald"
        />
      </div>

      {hasLadder && entry > 0 && (
        <PnLBar
          live={live}
          entry={entry}
          stop={stop}
          targets={targets}
          unrealizedPct={unrealizedPct}
          lossSpanPct={lossSpanPct}
          profitSpanPct={profitSpanPct}
        />
      )}
    </Card>
  );
}

function ClosedTradeRow({ trade }: { trade: EnrichedTrade }) {
  const pnl = trade.user_pnl_pct ?? 0;
  const isWin = pnl > 0;
  const isLoss = pnl < 0;
  const outcome = trade.outcome?.replace(/_/g, " ") ?? "closed";

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div
        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
          isWin
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-destructive/10 text-destructive"
        }`}
      >
        {isWin ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownRight className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold tabular-nums">{trade.ticker}</span>
          {trade.signal?.signal_grade && (
            <Badge variant="outline" className="text-[10px] py-0 h-5">
              {trade.signal.signal_grade}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {outcome}
            {prettyType(trade.signal?.signal_type) && (
              <> · {prettyType(trade.signal?.signal_type)}</>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {trade.closed_at ? relativeTime(trade.closed_at) : "—"}
          </span>
          <span className="tabular-nums font-mono">
            entry {fmtMoney(trade.user_entry_price)}
          </span>
        </div>
      </div>
      <div
        className={`text-right font-mono text-sm tabular-nums ${
          isWin
            ? "text-emerald-400"
            : isLoss
              ? "text-destructive"
              : "text-muted-foreground"
        }`}
      >
        {pnl > 0 ? "+" : ""}
        {pnl.toFixed(2)}%
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  subtle,
  tone,
}: {
  label: string;
  value: string;
  subtle?: string;
  tone?: "emerald" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "rose"
        ? "text-rose-300"
        : "text-foreground";
  return (
    <div>
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-sm font-mono font-semibold tabular-nums mt-0.5 ${toneClass}`}>
        {value}
      </div>
      {subtle && (
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {subtle}
        </div>
      )}
    </div>
  );
}

// Entry-centered P&L bar. Entry sits at the middle line; left half is
// the loss zone (stop at the left edge), right half is the profit zone
// (last target at the right edge). The current-price marker pulls left
// for a loss, right for a gain — matches what "+0.58% vs entry" feels
// like to the user instead of the abstract stop→target normalization.
function PnLBar({
  live,
  entry,
  stop,
  targets,
  unrealizedPct,
  lossSpanPct,
  profitSpanPct,
}: {
  live: number | null;
  entry: number;
  stop: number;
  targets: PersonalTarget[];
  unrealizedPct: number | null;
  lossSpanPct: number; // |entry → stop| as % of entry (positive)
  profitSpanPct: number; // |entry → T3| as % of entry (positive)
}) {
  // Where to draw the live-price marker, expressed as a % of bar width.
  // Center (50%) = at entry; 0% = at stop; 100% = at last target.
  let markerPct: number | null = null;
  if (live != null && unrealizedPct != null) {
    if (unrealizedPct < 0 && lossSpanPct > 0) {
      // In the loss half: 0..50%, where 0% = stop, 50% = entry.
      const portion = Math.min(1, Math.abs(unrealizedPct) / lossSpanPct);
      markerPct = 50 - portion * 50;
    } else if (unrealizedPct >= 0 && profitSpanPct > 0) {
      // In the profit half: 50..100%.
      const portion = Math.min(1, unrealizedPct / profitSpanPct);
      markerPct = 50 + portion * 50;
    } else {
      markerPct = 50;
    }
  }

  // Target tick positions on the right half. Each Tn is at
  // 50% + (Tn_pct / profitSpanPct) * 50%.
  const targetTicks = targets
    .map((t, i) => {
      if (entry <= 0 || profitSpanPct <= 0) return null;
      const tPct = ((t.price - entry) / entry) * 100;
      const portion = Math.min(1, tPct / profitSpanPct);
      return {
        i,
        leftPct: 50 + portion * 50,
        hit: !!t.hit,
        price: t.price,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t != null);

  return (
    <div className="space-y-3 pt-2">
      <div className="relative h-2 rounded-full bg-muted/40 border border-border/40 overflow-visible">
        {/* Loss zone (left half) — subtle red tint */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-rose-400/15"
          style={{ width: "50%" }}
        />
        {/* Profit zone (right half) — subtle emerald tint */}
        <div
          className="absolute inset-y-0 rounded-r-full bg-emerald-400/15"
          style={{ left: "50%", width: "50%" }}
        />
        {/* Filled progress from entry to live price (winners pull
            right green; losers pull left red). Read at a glance. */}
        {markerPct != null && (
          <div
            className={`absolute inset-y-0 ${
              markerPct >= 50
                ? "bg-emerald-400/40 rounded-r-full"
                : "bg-rose-400/40 rounded-l-full"
            }`}
            style={
              markerPct >= 50
                ? { left: "50%", width: `${markerPct - 50}%` }
                : { left: `${markerPct}%`, width: `${50 - markerPct}%` }
            }
          />
        )}
        {/* Entry midline */}
        <div
          className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-foreground/70"
          style={{ left: "50%" }}
        />
        {/* Stop (left edge) */}
        <div className="absolute top-[-3px] bottom-[-3px] left-0 w-[2px] bg-rose-400" />
        {/* Target ticks on the right half */}
        {targetTicks.map((tt) => (
          <div
            key={tt.i}
            className={`absolute top-[-3px] bottom-[-3px] w-[2px] ${
              tt.hit ? "bg-emerald-300" : "bg-emerald-400/60"
            }`}
            style={{ left: `${tt.leftPct}%` }}
          />
        ))}
        {/* Live price marker — circular dot above the line so it
            stands clearly apart from the static ticks. */}
        {markerPct != null && (
          <div
            className="absolute top-[-5px] h-3 w-3 rounded-full border-2 border-background bg-primary shadow-[0_0_10px_var(--color-primary)]"
            style={{ left: `calc(${markerPct}% - 6px)` }}
          />
        )}
      </div>

      {/* Bar legend — three rows that map directly to what's on the bar:
          stop edge on the left, entry in the middle, targets on the
          right. Color-coded so the user reads "red = bad, green = good"
          without thinking. */}
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
          <span className="truncate">
            <span className="text-rose-300">stop</span>{" "}
            <span className="text-foreground">{fmtMoney(stop)}</span>
          </span>
        </div>
        <div className="text-center text-muted-foreground">
          <span className="text-foreground">entry</span> {fmtMoney(entry)}
        </div>
        <div className="flex items-center gap-1.5 justify-end text-muted-foreground">
          <span className="truncate text-right">
            <span className="text-emerald-300">targets</span>{" "}
            <span className="text-foreground">
              {targets
                .map((t, i) => `T${i + 1} ${fmtMoney(t.price)}`)
                .join(" · ")}
            </span>
          </span>
          <TargetIcon className="h-3 w-3 text-emerald-400 shrink-0" />
        </div>
      </div>
    </div>
  );
}

// ---------- data helpers ----------

async function fetchLivePricesForActive(
  chatId: number,
  symbols: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (symbols.length === 0) return out;

  const db = supabaseAdmin();
  // Quote fetching uses the paper connection — Alpaca's data API is
  // the same hostname regardless of paper/live key, and Phase 4a
  // routes orders through paper anyway. Scoping to mode='paper'
  // also avoids the multiple-rows error from .maybeSingle() now that
  // paper + live broker_connections can coexist for the same user.
  const { data: conn } = await db
    .from("broker_connections")
    .select("encrypted_api_key, encrypted_api_secret, mode")
    .eq("chat_id", chatId)
    .eq("broker", "alpaca")
    .eq("mode", "paper")
    .eq("is_active", true)
    .maybeSingle();
  if (!conn) return out;

  try {
    const apiKey = decrypt(conn.encrypted_api_key as unknown as EncryptedBlob);
    const apiSecret = decrypt(
      conn.encrypted_api_secret as unknown as EncryptedBlob,
    );
    const client = new AlpacaClient(apiKey, apiSecret, conn.mode as "paper");
    // De-dupe in case the user has multiple trades on the same ticker.
    const uniq = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
    const results = await Promise.all(
      uniq.map(async (s) => [s, await client.getLatestPrice(s)] as const),
    );
    for (const [s, p] of results) if (p != null) out.set(s, p);
  } catch (exc) {
    console.error("portfolio live-price fetch failed", exc);
  }
  return out;
}

// ---------- formatting helpers ----------

function normalizeTargets(
  raw: Record<string, PersonalTarget> | null | undefined,
): PersonalTarget[] {
  if (!raw) return [];
  const order = ["t1", "t2", "t3"];
  return order
    .map((k) => raw[k])
    .filter((t): t is PersonalTarget => t != null && Number.isFinite(t.price));
}

function prettyType(raw?: string | null): string | null {
  if (!raw) return null;
  const labels: Record<string, string> = {
    volume_spike: "Unusual buying surge",
    trend_up: "Steady upward pressure",
    momentum_up: "Steady upward pressure",
    ws_momentum_up: "Steady upward pressure",
    trend_with_volume: "Strong trend with heavy volume",
    rsi_bounce: "Bouncing from a low point",
    rsi_oversold: "Bouncing from a low point",
    rsi_overbought: "Riding strong momentum",
    gap_up: "Strong open, buyers in control",
    gap_down: "Sharp drop, bounce possible",
    momentum_down: "Selling pressure",
    ws_momentum_down: "Selling pressure",
    mixed_setup: "Multiple indicators align",
    cross_platform: "Confirmed on two platforms",
  };
  if (labels[raw]) return labels[raw];
  // Trim leading "ws_" / "rt_" prefixes the websocket scanner adds and
  // try the lookup again before falling back to the raw underscored
  // string. Keeps unknown types readable without inventing a label.
  const stripped = raw.replace(/^(ws_|rt_)/, "");
  if (labels[stripped]) return labels[stripped];
  return stripped.replace(/_/g, " ");
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
