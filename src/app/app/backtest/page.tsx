import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, TrendingUp } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Backtest scoreboard. Aggregates from public.signal_backtests, which
// the bot's nightly compute_backtests.py refreshes from
// signal_history. We deliberately surface this to every logged-in
// user — the goal is trust, and trust comes from showing the
// numbers the same way to everyone.
//
// Why not behind an Elite gate: prospects evaluating us before they
// pay deserve to see hit rate / avg gain. Hiding it would suggest we
// have something to hide.

type BacktestRow = {
  signal_type: string;
  grade: string;
  window_days: number;
  n_signals: number;
  n_winners: number;
  win_rate_pct: number;
  avg_gain_pct: number;
  median_gain_pct: number;
  median_hold_mins: number;
  best_gain_pct: number;
  worst_gain_pct: number;
  last_computed: string;
};

const WINDOW_TABS = [
  { days: 0, label: "All time" },
  { days: 90, label: "Last 90d" },
  { days: 30, label: "Last 30d" },
];

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  stocks: "Stock signals",
  options: "Options signals",
  etf_calls: "ETF directional calls",
  smart_money: "Smart Money trades",
};

export default async function BacktestPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/app/backtest");

  const params = await searchParams;
  const windowDays = (() => {
    const v = parseInt(params.window ?? "0", 10);
    return [0, 30, 90].includes(v) ? v : 0;
  })();

  const db = supabaseAdmin();
  const { data: rowsRaw } = await db
    .from("signal_backtests")
    .select("*")
    .eq("window_days", windowDays);

  const rows = ((rowsRaw ?? []) as BacktestRow[]).filter(
    (r) => r.n_signals > 0,
  );

  // Group by signal_type with the "all" grade pulled out as the
  // headline so the user sees the top-line number first, then can
  // drill into per-grade rows.
  const bySignal = new Map<string, BacktestRow[]>();
  for (const r of rows) {
    const list = bySignal.get(r.signal_type) ?? [];
    list.push(r);
    bySignal.set(r.signal_type, list);
  }
  const signalTypes = [...bySignal.keys()].sort();

  // Right-side stat tiles for the header — total signals tracked
  // across all signal types (sum of n_signals for every "all" grade
  // row in this window) and last-updated timestamp. Filling the
  // dead right rail with relevant info makes the page feel useful
  // even before the user reads any of the table rows.
  const totalTracked = rows
    .filter((r) => r.grade === "all")
    .reduce((sum, r) => sum + r.n_signals, 0);
  const lastComputed = rows.length > 0 ? rows[0].last_computed : null;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.69_0.16_165_/_0.6)]" />
            Track record
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Backtest</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            Aggregate hit rate and average gain for every signal type
            we&rsquo;ve fired, computed across the full user base.
            Refreshed nightly from the same signal log we use to grade
            your personal /history.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          {WINDOW_TABS.map((tab) => (
            <a
              key={tab.days}
              href={`/app/backtest${tab.days === 0 ? "" : `?window=${tab.days}`}`}
              className={`px-3 py-1.5 rounded-md text-sm transition ${
                windowDays === tab.days
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>
      </header>

      {totalTracked > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground tabular-nums">
          <span>
            Tracking{" "}
            <span className="text-foreground font-semibold">
              {totalTracked.toLocaleString()}
            </span>{" "}
            resolved signals across {signalTypes.length} type
            {signalTypes.length === 1 ? "" : "s"}
          </span>
          {lastComputed && (
            <span>· Last updated {fmtAge(lastComputed)}</span>
          )}
        </div>
      )}

      <Alert className="px-5 py-4 border-border/60 bg-muted/20">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm leading-relaxed text-muted-foreground max-w-3xl space-y-2">
          <p>
            <b className="text-foreground">Methodology.</b> Win = closed
            with positive gain. Average and median include winners and
            losers. Outcomes are computed at signal close (TP1 / TP2 /
            stop or manual exit), not on a fixed holding period — so
            &ldquo;avg gain&rdquo; reflects what a user who took every
            signal would&rsquo;ve realized on average, not a
            buy-and-hold backtest.
          </p>
          <p>
            Cells with{" "}
            <span className="font-medium text-amber-300">n &lt; 30</span>{" "}
            are flagged as preliminary — small samples produce noisy
            hit-rate numbers (a single early winner reads as 100%) and
            shouldn&rsquo;t be treated as a track record yet.
          </p>
        </AlertDescription>
      </Alert>

      {signalTypes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-border/60 bg-card/40">
          No signals have closed in this window yet. Either the data
          is too fresh, or the nightly aggregation hasn&rsquo;t run.
        </Card>
      ) : (
        <div className="space-y-6">
          {signalTypes.map((st) => (
            <SignalTypeCard
              key={st}
              signalType={st}
              rows={bySignal.get(st) ?? []}
            />
          ))}
        </div>
      )}

    </div>
  );
}

// Below this N, numbers are presented as "preliminary" — a tiny
// sample produces noisy percentages (1/1 = 100% is technically true
// but practically meaningless) and showing them in normal emphasis
// is the kind of false-confidence signal the rest of EdgeNiq tries
// to avoid. 30 is a common rule-of-thumb minimum for treating a
// rate as a stable estimate.
const MIN_RELIABLE_N = 30;

function SignalTypeCard({
  signalType,
  rows,
}: {
  signalType: string;
  rows: BacktestRow[];
}) {
  const all = rows.find((r) => r.grade === "all");
  const byGrade = rows
    .filter((r) => r.grade !== "all")
    .sort((a, b) => a.grade.localeCompare(b.grade));
  const isPreliminary = all !== undefined && all.n_signals < MIN_RELIABLE_N;

  return (
    <Card className="p-0 border-border/60 bg-card/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
            {SIGNAL_TYPE_LABEL[signalType] ?? signalType}
            {isPreliminary && (
              <Badge
                variant="outline"
                className="border-amber-400/40 bg-amber-400/10 text-amber-300 text-[10px] py-0 h-5"
              >
                Preliminary · n={all?.n_signals ?? 0}
              </Badge>
            )}
          </h2>
          {all && (
            <p className="text-xs text-muted-foreground mt-1">
              {all.n_signals} signals · {all.n_winners} winners
              {isPreliminary &&
                ` · need ${MIN_RELIABLE_N - all.n_signals} more for reliable rate`}
            </p>
          )}
        </div>
        {all && !isPreliminary && (
          <div className="flex items-center gap-3">
            <Stat
              label="Win rate"
              value={`${all.win_rate_pct.toFixed(1)}%`}
              tone={
                all.win_rate_pct >= 60
                  ? "emerald"
                  : all.win_rate_pct >= 50
                    ? "primary"
                    : "amber"
              }
            />
            <Stat
              label="Avg gain"
              value={`${all.avg_gain_pct >= 0 ? "+" : ""}${all.avg_gain_pct.toFixed(2)}%`}
              tone={all.avg_gain_pct >= 0 ? "emerald" : "rose"}
            />
            <Stat
              label="Median hold"
              value={fmtMins(all.median_hold_mins)}
              tone="muted"
            />
          </div>
        )}
        {all && isPreliminary && (
          // Sample is too small to claim a hit rate. Show the raw
          // counts with no emphasis — no big "100%" stat tile that
          // a glancing reader would mistake for a track record.
          <div className="text-xs text-muted-foreground tabular-nums">
            {all.n_winners}/{all.n_signals} closed positive · still
            gathering data
          </div>
        )}
      </div>
      {byGrade.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Grade</th>
                <th className="px-4 py-2 font-medium text-right">N</th>
                <th className="px-4 py-2 font-medium text-right">Win rate</th>
                <th className="px-4 py-2 font-medium text-right">Avg gain</th>
                <th className="px-4 py-2 font-medium text-right">Median</th>
                <th className="px-4 py-2 font-medium text-right">Best</th>
                <th className="px-4 py-2 font-medium text-right">Worst</th>
                <th className="px-4 py-2 font-medium text-right">Hold</th>
              </tr>
            </thead>
            <tbody>
              {byGrade.map((r) => {
                const tooSmall = r.n_signals < MIN_RELIABLE_N;
                // Tone the win-rate / avg-gain columns down to muted
                // when the row's n is too small. The number is still
                // visible (transparency) but no longer dressed in
                // emerald/primary/amber — a 100% rate on n=1 should
                // not visually outshine a 62% rate on n=200.
                return (
                <tr
                  key={`${r.grade}-${r.window_days}`}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="px-5 py-2.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 h-5 font-mono ${gradeBadgeTone(r.grade)}`}
                    >
                      {r.grade}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-right text-muted-foreground">
                    {r.n_signals}
                    {tooSmall && (
                      <span className="ml-1.5 text-[9px] uppercase tracking-wider text-amber-300/80">
                        prelim
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 tabular-nums text-right ${
                      tooSmall
                        ? "text-muted-foreground"
                        : r.win_rate_pct >= 60
                          ? "text-emerald-300"
                          : r.win_rate_pct >= 50
                            ? "text-primary"
                            : "text-amber-300"
                    }`}
                  >
                    {r.win_rate_pct.toFixed(1)}%
                  </td>
                  <td
                    className={`px-4 py-2.5 tabular-nums text-right ${
                      tooSmall
                        ? "text-muted-foreground"
                        : r.avg_gain_pct >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                    }`}
                  >
                    {r.avg_gain_pct >= 0 ? "+" : ""}
                    {r.avg_gain_pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-right text-muted-foreground">
                    {r.median_gain_pct >= 0 ? "+" : ""}
                    {r.median_gain_pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-right text-emerald-400/80">
                    {r.best_gain_pct >= 0 ? "+" : ""}
                    {r.best_gain_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-right text-rose-400/80">
                    {r.worst_gain_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-right text-muted-foreground">
                    {fmtMins(r.median_hold_mins)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "rose" | "amber" | "primary" | "muted";
}) {
  const cls = {
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    amber: "text-amber-300",
    primary: "text-primary",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="text-right">
      <div className={`text-base font-semibold tabular-nums ${cls}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function gradeBadgeTone(grade: string): string {
  if (grade === "A") return "border-emerald-400/40 text-emerald-300";
  if (grade === "B") return "border-primary/40 text-primary";
  if (grade === "C") return "border-amber-400/40 text-amber-300";
  return "border-border/60 text-muted-foreground";
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const hrs = mins / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  const days = hrs / 24;
  return `${days.toFixed(1)}d`;
}

function fmtAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
