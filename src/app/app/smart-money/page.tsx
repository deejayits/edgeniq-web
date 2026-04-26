import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, TrendingUp, Shield } from "lucide-react";
import { HeaderStat } from "@/components/header-stat";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isEliteAccess } from "@/lib/access";
import { TargetCard } from "./target-card";
import {
  TARGET_TYPE_DESC,
  TARGET_TYPE_LABEL,
  type SmartMoneyTarget,
  type SmartMoneyTrade,
  type TargetType,
  type TargetWithStats,
} from "./types";

export const dynamic = "force-dynamic";

// Smart Money — browse + follow politicians, hedge funds, insiders,
// activists. Elite-tier feature. Mimic (auto-shadow-trade) requires
// the Live Trading add-on on top of Elite.

export default async function SmartMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();
  const user = session?.user as
    | { tgUserId?: number; role?: string; subPlan?: string }
    | undefined;
  if (!user?.tgUserId) redirect("/login?next=/app/smart-money");

  const params = await searchParams;
  const typeFilter = params.type as TargetType | undefined;

  const supabase = supabaseAdmin();

  // Elite gate — check sub_status.
  const { data: userRow } = await supabase
    .from("users")
    .select("sub_plan, sub_status, addon_live_trading")
    .eq("chat_id", user.tgUserId)
    .maybeSingle();

  const eliteish = isEliteAccess({
    role: user.role,
    subPlan: userRow?.sub_plan ?? user.subPlan,
    subStatus: userRow?.sub_status,
  });

  if (!eliteish) {
    return (
      <div className="space-y-10">
        <header>
          <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_oklch(0.488_0.243_264.376_/_0.6)]" />
            Intel
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Smart Money
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-4xl">
            Follow politicians, hedge funds, and insiders. See what they
            bought before it hits the news.
          </p>
        </header>
        <Card className="p-8 text-center border-border/60 bg-card/40 space-y-3">
          <Badge className="bg-violet-400/15 text-violet-300 border border-violet-400/30">
            Elite feature
          </Badge>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Browse, follow, and optionally mirror trades from Congress,
            hedge fund 13Fs, and insider Form 4 filings. Upgrade to
            Elite to unlock.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/#pricing">See pricing</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Load targets + recent trade counts + user's follows in parallel.
  //
  // Window = 90 days, not 30. 13F filings are quarterly with a 45-day
  // filing lag — at a 30-day horizon, every 13F position appears
  // "expired" the day after landing. 90 days captures a full quarter's
  // disclosed activity, which matches the actual cadence of the data
  // source. Congressional filings (when they ingest) also report with
  // up to 45-day STOCK Act delay, so 90d is the right window there too.
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [targetsRes, tradesRes, followsRes] = await Promise.all([
    supabase
      .from("smart_money_targets")
      .select("*")
      .eq("is_active", true)
      .order("browse_priority", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("smart_money_trades")
      .select("target_id, symbol, trade_date")
      .gte("trade_date", since.toISOString().slice(0, 10)),
    supabase
      .from("smart_money_follows")
      .select("*")
      .eq("chat_id", user.tgUserId),
  ]);

  const targets = (targetsRes.data ?? []) as SmartMoneyTarget[];
  const trades = (tradesRes.data ?? []) as Pick<
    SmartMoneyTrade,
    "target_id" | "symbol" | "trade_date"
  >[];
  const follows = new Map(
    (followsRes.data ?? []).map((f) => [f.target_id as string, f]),
  );

  // Aggregate trade counts + top symbols per target.
  const statsByTarget = new Map<
    string,
    { count: number; lastDate: string | null; symbols: Map<string, number> }
  >();
  for (const t of trades) {
    const cur = statsByTarget.get(t.target_id) ?? {
      count: 0,
      lastDate: null as string | null,
      symbols: new Map<string, number>(),
    };
    cur.count++;
    if (!cur.lastDate || t.trade_date > cur.lastDate) cur.lastDate = t.trade_date;
    cur.symbols.set(t.symbol, (cur.symbols.get(t.symbol) ?? 0) + 1);
    statsByTarget.set(t.target_id, cur);
  }

  const withStats: TargetWithStats[] = targets.map((t) => {
    const stats = statsByTarget.get(t.id);
    const topSymbols = stats
      ? [...stats.symbols.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([s]) => s)
      : [];
    const f = follows.get(t.id);
    return {
      ...t,
      trade_count_30d: stats?.count ?? 0,
      last_trade_date: stats?.lastDate ?? null,
      top_symbols: topSymbols,
      is_followed: !!f,
      mimic_enabled: !!f?.mimic_on_trades,
    };
  });

  const visible = typeFilter
    ? withStats.filter((t) => t.target_type === typeFilter)
    : withStats;

  const counts: Record<TargetType, number> = {
    politician: 0,
    fund_13f: 0,
    insider: 0,
    activist: 0,
  };
  for (const t of withStats) counts[t.target_type]++;

  const followedIds = withStats.filter((t) => t.is_followed);

  // Right-rail summary stats — aggregate counts across the universe
  // and the user's relationship to it. Filling the dead right space
  // with information density beats the previous "lonely outline
  // button stranded next to the title".
  const totalTrades90d = trades.length;
  const followedCount = followedIds.length;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_oklch(0.488_0.243_264.376_/_0.6)]" />
            Intel
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Smart Money
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            Follow politicians, hedge funds, and insiders. Get alerts
            when they disclose new positions — optionally mirror them
            automatically via Alpaca.
          </p>
        </div>
        <div className="flex items-stretch gap-3">
          <HeaderStat
            label="Targets"
            value={withStats.length.toLocaleString()}
            sub={
              followedCount > 0
                ? `${followedCount} followed`
                : "browse to follow"
            }
            tone={followedCount > 0 ? "primary" : "muted"}
          />
          <HeaderStat
            label="Trades"
            value={totalTrades90d.toLocaleString()}
            sub="last 90 days"
            tone="muted"
          />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="self-end h-9"
          >
            <Link href="/app/smart-money/compare">
              <TrendingUp className="h-3.5 w-3.5" />
              Compare portfolios
            </Link>
          </Button>
        </div>
      </div>

      <Alert className="px-5 py-4 border-amber-500/30 bg-amber-500/5">
        <Info className="h-4 w-4 text-amber-300" />
        <AlertDescription className="text-sm leading-relaxed text-amber-200/90 max-w-5xl">
          <b>Data latency matters.</b> Congressional filings are 30-45
          days stale — a buy you see today was likely placed 6+ weeks
          ago. Use for conviction, not fresh signals. Insider Form 4
          (2-day latency) is the fastest smart-money data — we&rsquo;ll
          add that next.
        </AlertDescription>
      </Alert>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <FilterTab
          href="/app/smart-money"
          active={!typeFilter}
          label="All"
          count={withStats.length}
        />
        {(Object.keys(counts) as TargetType[]).map(
          (tt) =>
            counts[tt] > 0 && (
              <FilterTab
                key={tt}
                href={`/app/smart-money?type=${tt}`}
                active={typeFilter === tt}
                label={TARGET_TYPE_LABEL[tt]}
                count={counts[tt]}
              />
            ),
        )}
      </div>

      {/* Following section — only shown when user has follows */}
      {followedIds.length > 0 && !typeFilter && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Following ({followedIds.length})
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {followedIds.map((t) => (
              <TargetCard key={t.id} target={t} />
            ))}
          </div>
        </section>
      )}

      {/* Discover / Browse */}
      <section className="space-y-3">
        {followedIds.length > 0 && !typeFilter && (
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Discover
          </h2>
        )}
        {typeFilter && (
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            {TARGET_TYPE_DESC[typeFilter]}
          </p>
        )}
        {visible.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground border-border/60 bg-card/40">
            No targets match this filter yet.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible
              .filter((t) => !t.is_followed || typeFilter)
              .map((t) => (
                <TargetCard key={t.id} target={t} />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm transition ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {label}{" "}
      <span className="text-xs opacity-70 tabular-nums ml-0.5">{count}</span>
    </Link>
  );
}
