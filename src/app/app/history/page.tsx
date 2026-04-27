import { auth } from "@/auth";
import { HeaderStat } from "@/components/header-stat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatSymbol, formatSymbolLong } from "@/lib/options-format";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  ListChecks,
  Target,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Signal history — every resolved signal for this user. Each row has
// entry/exit/outcome. Sorted newest-first.
export default async function HistoryPage() {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!tgUserId) return null;

  const db = supabaseAdmin();
  // Pull both data sources in parallel:
  //   - signal_history: signals the user /confirm-tracked that have
  //     since resolved (the original "history" semantic).
  //   - auto_trades SELL closes: positions the auto-trader closed via
  //     target hit / stop hit / EOD flatten. Without this, /history
  //     showed "Nothing resolved yet" even after the bot closed
  //     trades for net +$498 today — the user explicitly asked for
  //     these to appear here.
  const [{ data: sigRecs }, { data: autoCloseRecs }] = await Promise.all([
    db
      .from("signal_history")
      .select("*")
      .eq("user_chat_id", tgUserId)
      .order("closed_at", { ascending: false })
      .limit(200),
    db
      .from("auto_trades")
      .select(
        "id, symbol, signal_type, qty, avg_fill_price, submitted_at, closed_at, realized_pnl, close_reason, parent_trade_id, mode",
      )
      .eq("chat_id", tgUserId)
      .eq("side", "sell")
      .not("parent_trade_id", "is", null)
      .order("closed_at", { ascending: false })
      .limit(100),
  ]);

  // Pull parent BUYs for the SELL closes so we can render entry
  // price + hold time. One round trip; cheaper than per-row joins.
  const parentIds = (autoCloseRecs ?? [])
    .map((r) => r.parent_trade_id)
    .filter((v): v is string => !!v);
  let parentMap = new Map<
    string,
    { id: string; avg_fill_price: number | null; submitted_at: string; symbol: string }
  >();
  if (parentIds.length > 0) {
    const { data: parents } = await db
      .from("auto_trades")
      .select("id, avg_fill_price, submitted_at, symbol")
      .in("id", parentIds);
    parentMap = new Map(
      ((parents ?? []) as Array<{
        id: string;
        avg_fill_price: number | null;
        submitted_at: string;
        symbol: string;
      }>).map((p) => [p.id, p]),
    );
  }

  // Convert auto-trade closes into the same shape the history table
  // expects (ticker / setup / entry / exit / outcome / gain / hold)
  // so the existing renderer accepts them without per-row branching.
  type HistoryRow = {
    id: string | number;
    ticker: string;
    signal_type: string | null;
    entry_price: number;
    exit_price: number;
    exit_reason: string;
    gain_pct: number;
    closed_at: string;
    hold_time_mins: number;
    isAuto?: boolean;
  };
  const autoHistoryRows: HistoryRow[] = (autoCloseRecs ?? [])
    .filter((r) => r.closed_at && r.parent_trade_id)
    .map((r) => {
      const parent = r.parent_trade_id
        ? parentMap.get(r.parent_trade_id)
        : undefined;
      const entry = Number(parent?.avg_fill_price ?? 0);
      const exit = Number(r.avg_fill_price ?? 0);
      const gainPct =
        entry > 0 && exit > 0 ? ((exit - entry) / entry) * 100 : 0;
      const holdMins =
        parent?.submitted_at && r.closed_at
          ? Math.max(
              0,
              Math.round(
                (Date.parse(r.closed_at) - Date.parse(parent.submitted_at)) /
                  60000,
              ),
            )
          : 0;
      const setup =
        r.signal_type === "options" ? "auto-trade · options" : "auto-trade";
      const outcome = (() => {
        switch ((r.close_reason ?? "").toLowerCase()) {
          case "target_hit":
            return "target_hit";
          case "stop_hit":
            return "stopped_out";
          case "eod_close":
            return "eod_flatten";
          default:
            return r.close_reason ?? "closed";
        }
      })();
      return {
        id: `auto-${r.id}`,
        ticker: r.symbol,
        signal_type: setup,
        entry_price: entry,
        exit_price: exit,
        exit_reason: outcome,
        gain_pct: gainPct,
        closed_at: r.closed_at as string,
        hold_time_mins: holdMins,
        isAuto: true,
      };
    });

  // Merge + sort newest-first. Cap at 200 rows total to match the
  // page's existing budget (the description copy promises "last 200").
  const records: HistoryRow[] = [
    ...((sigRecs ?? []) as HistoryRow[]),
    ...autoHistoryRows,
  ]
    .sort((a, b) => Date.parse(b.closed_at) - Date.parse(a.closed_at))
    .slice(0, 200);

  const wins = records.filter((r) => r.gain_pct > 0);
  const losses = records.filter((r) => r.gain_pct <= 0);
  const total = records.length;
  const winRate = total > 0 ? (wins.length / total) * 100 : 0;
  const avgGain =
    total > 0
      ? records.reduce((s, r) => s + r.gain_pct, 0) / total
      : 0;
  // Best + worst single trade — extra signal beyond the averages.
  const bestTrade = records[0]
    ? records.reduce(
        (best, r) => (r.gain_pct > (best?.gain_pct ?? -Infinity) ? r : best),
        records[0],
      )
    : null;
  const worstTrade = records[0]
    ? records.reduce(
        (worst, r) => (r.gain_pct < (worst?.gain_pct ?? Infinity) ? r : worst),
        records[0],
      )
    : null;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_oklch(0.78_0.17_85_/_0.6)]" />
            Activity
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            Every signal you received that has resolved — hit a target,
            stopped out, or expired after 48h. Newest first, capped at the
            last 200.
          </p>
        </div>
        {/* Always render the tiles so the header layout stays
            balanced — empty state just shows em-dashes. Without this
            the description reflows onto two lines on wide screens
            because the right side collapses. */}
        <div className="flex items-stretch gap-3">
          <HeaderStat
            label="Resolved"
            value={total > 0 ? total.toLocaleString() : "0"}
            sub={total > 0 ? "last 200" : "no history yet"}
            tone="muted"
          />
          <HeaderStat
            label="Win rate"
            value={total > 0 ? `${winRate.toFixed(1)}%` : "—"}
            sub={
              total > 0
                ? `${wins.length}W · ${losses.length}L`
                : "win/loss split"
            }
            tone={
              total === 0
                ? "muted"
                : winRate >= 60
                  ? "emerald"
                  : winRate >= 50
                    ? "primary"
                    : "amber"
            }
          />
          <HeaderStat
            label="Avg gain"
            value={
              total > 0
                ? `${avgGain >= 0 ? "+" : ""}${avgGain.toFixed(2)}%`
                : "—"
            }
            sub="per signal"
            tone={total === 0 ? "muted" : avgGain >= 0 ? "emerald" : "rose"}
          />
        </div>
      </header>

      <section className="grid md:grid-cols-4 gap-4">
        <StatCard
          tone="sky"
          icon={ListChecks}
          label="Total resolved"
          value={total.toString()}
          hint={total === 0 ? "No history yet" : "Across all signals"}
        />
        <StatCard
          tone="emerald"
          icon={Target}
          label="Win rate"
          value={`${winRate.toFixed(1)}%`}
          hint={
            total > 0
              ? `${wins.length} win${wins.length === 1 ? "" : "s"} · ${losses.length} loss${losses.length === 1 ? "" : "es"}`
              : "Win/loss split"
          }
        />
        <StatCard
          tone={avgGain >= 0 ? "emerald" : "rose"}
          icon={TrendingUp}
          label="Avg gain / signal"
          value={`${avgGain > 0 ? "+" : ""}${avgGain.toFixed(2)}%`}
          hint="Across all resolved trades"
        />
        <StatCard
          tone="violet"
          icon={Activity}
          label="Best · Worst"
          value={
            bestTrade
              ? `${bestTrade.gain_pct > 0 ? "+" : ""}${bestTrade.gain_pct.toFixed(1)}% / ${worstTrade && worstTrade.gain_pct < 0 ? "" : "+"}${worstTrade?.gain_pct.toFixed(1) ?? "0"}%`
              : "—"
          }
          hint={
            bestTrade
              ? `${formatSymbol(bestTrade.ticker)} · ${worstTrade?.ticker ? formatSymbol(worstTrade.ticker) : "—"}`
              : "Top + bottom outliers"
          }
        />
      </section>

      <section>
        {total === 0 ? (
          <EmptyState />
        ) : (
          <Card className="border-border/60 bg-card/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Exit</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Gain</TableHead>
                  <TableHead className="text-right">Hold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => {
                  const isWin = r.gain_pct > 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                              isWin
                                ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/30"
                                : "bg-rose-400/10 text-rose-300 border border-rose-400/30"
                            }`}
                          >
                            {isWin ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <span
                            className="font-semibold tabular-nums"
                            title={formatSymbolLong(r.ticker)}
                          >
                            {formatSymbol(r.ticker)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {prettyType(r.signal_type) || "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-right">
                        ${r.entry_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="tabular-nums text-right">
                        ${r.exit_price.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className={outcomeBadgeClass(r.exit_reason)}>
                          {prettyOutcome(r.exit_reason)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono tabular-nums ${
                          isWin
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }`}
                      >
                        {isWin ? "+" : ""}
                        {r.gain_pct.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs inline-flex items-center justify-end gap-1 w-full">
                        <Clock className="h-3 w-3" />
                        {fmtHold(r.hold_time_mins)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}

const STAT_TONE: Record<
  "emerald" | "violet" | "sky" | "rose",
  {
    iconBg: string;
    iconBorder: string;
    iconFg: string;
    glowColor: string;
    valueText: string;
  }
> = {
  emerald: {
    iconBg: "bg-emerald-400/10",
    iconBorder: "border-emerald-400/30",
    iconFg: "text-emerald-300",
    glowColor: "oklch(0.69 0.16 165 / 0.18)",
    valueText: "text-foreground",
  },
  violet: {
    iconBg: "bg-violet-400/10",
    iconBorder: "border-violet-400/30",
    iconFg: "text-violet-300",
    glowColor: "oklch(0.488 0.243 264.376 / 0.18)",
    valueText: "text-foreground",
  },
  sky: {
    iconBg: "bg-sky-400/10",
    iconBorder: "border-sky-400/30",
    iconFg: "text-sky-300",
    glowColor: "oklch(0.7 0.14 230 / 0.18)",
    valueText: "text-foreground",
  },
  rose: {
    iconBg: "bg-rose-400/10",
    iconBorder: "border-rose-400/30",
    iconFg: "text-rose-300",
    glowColor: "oklch(0.7 0.18 15 / 0.18)",
    valueText: "text-rose-300",
  },
};

function StatCard({
  tone,
  icon: Icon,
  label,
  value,
  hint,
}: {
  tone: keyof typeof STAT_TONE;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  const t = STAT_TONE[tone];
  return (
    <Card className="relative p-6 border-border/60 bg-card/50 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-16 h-40 w-40 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${t.glowColor} 0%, transparent 70%)`,
        }}
      />
      <div className="relative flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div
          className={`h-8 w-8 rounded-md flex items-center justify-center border ${t.iconBg} ${t.iconBorder}`}
        >
          <Icon className={`h-4 w-4 ${t.iconFg}`} />
        </div>
      </div>
      <div className="relative">
        <div
          className={`text-2xl font-semibold tabular-nums ${t.valueText}`}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {hint}
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 border-border/60 bg-card/50 text-center">
      <div className="mx-auto h-14 w-14 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-center mb-4">
        <ListChecks className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-base">Nothing resolved yet</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
        When a signal you received hits a target, stops out, or expires
        after 48h, it lands here with the full entry → exit breakdown.
        Confirm signals from Telegram so they show up in this view.
      </p>
    </Card>
  );
}

// ---------- formatters ----------

function fmtHold(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(1)}h`;
  return `${(mins / 1440).toFixed(1)}d`;
}

function prettyType(raw?: string | null): string | null {
  if (!raw) return null;
  const labels: Record<string, string> = {
    volume_spike: "Volume spike",
    trend_up: "Trend up",
    momentum_up: "Momentum up",
    ws_momentum_up: "Momentum up",
    trend_with_volume: "Trend + volume",
    rsi_bounce: "RSI bounce",
    rsi_oversold: "RSI oversold",
    rsi_overbought: "RSI overbought",
    gap_up: "Gap up",
    gap_down: "Gap down",
    momentum_down: "Momentum down",
    ws_momentum_down: "Momentum down",
    mixed_setup: "Mixed setup",
    cross_platform: "Cross-platform",
  };
  if (labels[raw]) return labels[raw];
  const stripped = raw.replace(/^(ws_|rt_)/, "");
  if (labels[stripped]) return labels[stripped];
  return stripped.replace(/_/g, " ");
}

function prettyOutcome(raw: string): string {
  const map: Record<string, string> = {
    target_1_hit: "T1 hit",
    target_2_hit: "T2 hit",
    target_3_hit: "T3 hit",
    full_target_hit: "All targets",
    t1_partial: "T1 partial",
    t2_partial: "T2 partial",
    stopped: "Stopped",
    stopped_out: "Stopped",
    expired: "Expired",
    target_hit: "Target hit",
    eod_flatten: "EOD flatten",
  };
  return map[raw] ?? raw.replace(/_/g, " ");
}

function outcomeBadgeClass(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("hit") || r.includes("target")) {
    return "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 text-[10px] py-0 h-5";
  }
  if (r.includes("stopped")) {
    return "bg-rose-400/15 text-rose-300 border border-rose-400/30 text-[10px] py-0 h-5";
  }
  if (r.includes("expired") || r.includes("eod")) {
    return "bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[10px] py-0 h-5";
  }
  return "bg-muted/40 text-muted-foreground border border-border/60 text-[10px] py-0 h-5";
}
