import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/sparkline";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Flame,
  Keyboard,
  Target,
  XCircle,
} from "lucide-react";

// Dashboard home — "Today" view.
// Fetches in parallel: user row, active personal trades (count + list),
// 7-day signal history (for sparkline + recent activity timeline).
export default async function AppHome() {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!tgUserId) return null;

  const db = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: me }, { data: openTrades }, { data: recentSignals }] =
    await Promise.all([
      db
        .from("users")
        .select("username, risk_profile, strategy, sub_plan, watchlist")
        .eq("chat_id", tgUserId)
        .single(),
      db
        .from("personal_trades")
        .select("personal_trade_id, ticker, confirmed_at, status")
        .eq("chat_id", tgUserId)
        .eq("status", "active")
        .order("confirmed_at", { ascending: false }),
      db
        .from("signal_history")
        .select(
          "id, ticker, signal_type, exit_reason, gain_pct, closed_at, grade",
        )
        .eq("user_chat_id", tgUserId)
        .gte("closed_at", since)
        .order("closed_at", { ascending: false })
        .limit(20),
    ]);

  const resolvedLast24h = (recentSignals ?? []).filter(
    (r) => Date.parse(r.closed_at) >= Date.now() - 86_400_000,
  ).length;

  const signalSpark = buildDailyCounts(
    (recentSignals ?? []).map((r) => r.closed_at),
    7,
  );

  return (
    <div className="space-y-10">
      <Header user={me} />

      <section className="grid md:grid-cols-3 gap-4">
        <StatCard
          icon={Flame}
          label="Signals resolved (24h)"
          value={resolvedLast24h}
          hint="Closed with outcome"
          sparkValues={signalSpark}
          sparkStroke="text-emerald-400"
        />
        <StatCard
          icon={Target}
          label="Open positions"
          value={openTrades?.length ?? 0}
          hint="Confirmed personal trades"
          sparkValues={positionsFlatSpark(openTrades?.length ?? 0)}
          sparkStroke="text-violet-400"
        />
        <StatCard
          icon={Activity}
          label="Watchlist"
          value={me?.watchlist?.length ?? 0}
          hint="Tickers you track"
          sparkValues={watchlistFlatSpark(me?.watchlist?.length ?? 0)}
          sparkStroke="text-muted-foreground"
        />
      </section>

      <RecentActivity signals={recentSignals ?? []} />

      <HotkeyHint />
    </div>
  );
}

function Header({
  user,
}: {
  user: { risk_profile?: string; strategy?: string } | null;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider">
          Dashboard
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Good to see you back.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&rsquo;s where you stand right now.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          Risk: {user?.risk_profile ?? "moderate"}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Strategy: {user?.strategy ?? "balanced"}
        </Badge>
      </div>
    </header>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  sparkValues,
  sparkStroke,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint: string;
  sparkValues: number[];
  sparkStroke: string;
}) {
  return (
    <Card className="p-6 border-border/60 bg-card/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{hint}</div>
        </div>
        <div className={sparkStroke}>
          <Sparkline values={sparkValues} width={96} height={36} />
        </div>
      </div>
    </Card>
  );
}

// Timeline of resolved signals over the last 7 days. Mix of wins, losses,
// and expireds — grouped visually by outcome so the user sees their
// actual experience, not just counts.
function RecentActivity({
  signals,
}: {
  signals: Array<{
    id: number;
    ticker: string;
    signal_type: string;
    exit_reason: string;
    gain_pct: number;
    closed_at: string;
    grade: string;
  }>;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent activity
        </h2>
        <span className="text-xs text-muted-foreground">Last 7 days</span>
      </div>
      {signals.length === 0 ? (
        <Card className="p-8 border-border/60 bg-card/50 text-center">
          <p className="text-sm text-muted-foreground">
            No resolved signals in the last 7 days. When a signal hits a
            target or stop, it&rsquo;ll show up here.
          </p>
        </Card>
      ) : (
        <Card className="border-border/60 bg-card/50 divide-y divide-border/40">
          {signals.map((s) => {
            const win = s.gain_pct > 0;
            return (
              <div
                key={s.id}
                className="px-5 py-3.5 flex items-center gap-4"
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    win
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {win ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium tabular-nums">
                      {s.ticker}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {s.signal_type || "signal"} ·{" "}
                      {s.exit_reason.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {relativeTime(s.closed_at)}
                  </div>
                </div>
                <div
                  className={`text-sm font-mono tabular-nums flex items-center gap-1 ${
                    win ? "text-emerald-400" : "text-destructive"
                  }`}
                >
                  {win ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {win ? "+" : ""}
                  {s.gain_pct.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}

function HotkeyHint() {
  return (
    <div className="flex items-center justify-center text-xs text-muted-foreground border-t border-border/30 pt-6">
      <Keyboard className="h-3.5 w-3.5 mr-2 opacity-70" />
      Press{" "}
      <kbd className="mx-1.5 inline-flex items-center rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px]">
        ⌘ K
      </kbd>
      to jump anywhere
    </div>
  );
}

// ---------- helpers ----------

// Bucket ISO timestamps into N daily counts ending today.
function buildDailyCounts(timestamps: string[], days: number): number[] {
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  for (const ts of timestamps) {
    const age = now - Date.parse(ts);
    const idx = days - 1 - Math.floor(age / 86_400_000);
    if (idx >= 0 && idx < days) buckets[idx]++;
  }
  return buckets;
}

// For stat cards with no time-series data, render a flat line at the
// current value — visually communicates "stable" rather than rendering
// a noisy fake trend.
function positionsFlatSpark(n: number): number[] {
  return new Array(7).fill(n);
}
function watchlistFlatSpark(n: number): number[] {
  return new Array(7).fill(n);
}

// Relative time formatting — "3h ago", "2d ago", etc. Kept minimal.
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
