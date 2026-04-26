import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Info, TrendingUp } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isEliteAccess } from "@/lib/access";
import { ComparePicker } from "./compare-picker";
import { CompareChart } from "./compare-chart";
import {
  TARGET_TYPE_LABEL,
  type SmartMoneyTarget,
  type SmartMoneyTrade,
  type TargetType,
} from "../types";

export const dynamic = "force-dynamic";

const TYPE_ACCENT: Record<TargetType, string> = {
  politician: "bg-violet-400/15 text-violet-300 border-violet-400/30",
  fund_13f: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  insider: "bg-primary/15 text-primary border-primary/30",
  activist: "bg-amber-400/15 text-amber-300 border-amber-400/30",
};

const SERIES_COLOR = ["emerald-400", "violet-400", "amber-400"] as const;

function fmtMoney(n: number | null): string {
  if (n == null || n <= 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const session = await auth();
  const user = session?.user as
    | { tgUserId?: number; role?: string; subPlan?: string }
    | undefined;
  if (!user?.tgUserId) redirect("/login?next=/app/smart-money/compare");

  const params = await searchParams;
  const rawIds = params.ids;
  const selectedIds: string[] = Array.isArray(rawIds)
    ? rawIds
    : rawIds
      ? [rawIds]
      : [];
  const selectedSet = new Set(selectedIds.slice(0, 3));

  const supabase = supabaseAdmin();

  const { data: userRow } = await supabase
    .from("users")
    .select("sub_plan, sub_status")
    .eq("chat_id", user.tgUserId)
    .maybeSingle();
  if (
    !isEliteAccess({
      role: user.role,
      subPlan: userRow?.sub_plan ?? user.subPlan,
      subStatus: userRow?.sub_status,
    })
  ) {
    redirect("/app/smart-money");
  }

  const since = new Date();
  // 90-day window so quarterly 13F positions (45d filing lag) land in view.
  since.setDate(since.getDate() - 90);

  const [targetsRes, selectedTradesRes] = await Promise.all([
    supabase
      .from("smart_money_targets")
      .select("*")
      .eq("is_active", true)
      .order("browse_priority", { ascending: true })
      .order("display_name", { ascending: true }),
    selectedSet.size > 0
      ? supabase
          .from("smart_money_trades")
          .select("*")
          .in("target_id", [...selectedSet])
          .gte("trade_date", since.toISOString().slice(0, 10))
          .order("trade_date", { ascending: false })
      : Promise.resolve({ data: [] as SmartMoneyTrade[] }),
  ]);

  const allTargets = (targetsRes.data ?? []) as SmartMoneyTarget[];
  const selectedTargets = [...selectedSet]
    .map((id) => allTargets.find((t) => t.id === id))
    .filter((t): t is SmartMoneyTarget => !!t);
  const trades = (selectedTradesRes.data ?? []) as SmartMoneyTrade[];

  // Per-target aggregates for the side-by-side stats row.
  const perTarget = new Map(
    selectedTargets.map((t) => {
      const tgt = trades.filter((tr) => tr.target_id === t.id);
      const buys = tgt.filter((x) => x.side === "buy").length;
      const sells = tgt.filter((x) => x.side === "sell").length;
      const totalEst = tgt.reduce(
        (s, x) => s + (x.size_estimate_usd ?? 0),
        0,
      );
      const symCounts = new Map<string, number>();
      for (const x of tgt) {
        symCounts.set(x.symbol, (symCounts.get(x.symbol) ?? 0) + 1);
      }
      const topSyms = [...symCounts.keys()];
      return [
        t.id,
        {
          target: t,
          trades: tgt,
          buys,
          sells,
          totalEst,
          topSymbols: topSyms,
        },
      ];
    }),
  );

  // Portfolio-overlap analysis: tickers traded by 2+ of the selected
  // targets. Sort by breadth (# of targets) then by total activity.
  const overlapMap = new Map<
    string,
    { symbol: string; targetIds: Set<string>; totalTrades: number }
  >();
  for (const tr of trades) {
    const cur = overlapMap.get(tr.symbol) ?? {
      symbol: tr.symbol,
      targetIds: new Set<string>(),
      totalTrades: 0,
    };
    cur.targetIds.add(tr.target_id);
    cur.totalTrades++;
    overlapMap.set(tr.symbol, cur);
  }
  const overlaps = [...overlapMap.values()]
    .filter(
      (o) => o.targetIds.size >= 2 && selectedTargets.length >= 2,
    )
    .sort(
      (a, b) =>
        b.targetIds.size - a.targetIds.size ||
        b.totalTrades - a.totalTrades,
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs mb-2">
            <Link href="/app/smart-money">
              <ArrowLeft className="h-3 w-3" />
              All smart money
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Compare portfolios
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-4xl">
            Pick up to three politicians, funds, or insiders to see
            side-by-side. Shared holdings show up below — that&rsquo;s
            where consensus-driven edge lives.
          </p>
        </div>
      </div>

      <ComparePicker
        targets={allTargets}
        selectedIds={selectedIds.slice(0, 3)}
      />

      {selectedTargets.length === 0 ? (
        <Card className="p-10 text-center border-border/60 bg-card/40">
          <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Add at least one target above to start comparing.
          </p>
        </Card>
      ) : (
        <>
          {/* Activity rhythm chart */}
          <Card className="p-5 border-border/60 bg-card/40">
            <h2 className="text-sm font-medium mb-1">
              Cumulative activity — last 90 days
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Running total of disclosed trades over the window.
            </p>
            <CompareChart
              targets={selectedTargets.map((t) => ({
                id: t.id,
                display_name: t.display_name,
              }))}
              trades={trades.map((tr) => ({
                target_id: tr.target_id,
                trade_date: tr.trade_date,
              }))}
            />
          </Card>

          {/* Per-target stat columns */}
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${selectedTargets.length}, minmax(0, 1fr))`,
            }}
          >
            {selectedTargets.map((t, i) => {
              const info = perTarget.get(t.id)!;
              const color = SERIES_COLOR[i % SERIES_COLOR.length];
              return (
                <Card
                  key={t.id}
                  className="p-4 border-border/60 bg-card/40 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full bg-${color} shrink-0 mt-1.5`}
                      style={{
                        backgroundColor:
                          color === "emerald-400"
                            ? "#34d399"
                            : color === "violet-400"
                              ? "#a78bfa"
                              : "#fbbf24",
                      }}
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/app/smart-money/${t.id}`}
                        className="font-medium text-sm hover:underline truncate block"
                      >
                        {t.display_name}
                      </Link>
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 h-4 ${TYPE_ACCENT[t.target_type]} mt-1`}
                      >
                        {TARGET_TYPE_LABEL[t.target_type]}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                    <StatMini label="Trades" value={String(info.trades.length)} />
                    <StatMini
                      label="Buy/Sell"
                      value={`${info.buys}/${info.sells}`}
                    />
                    <StatMini
                      label="Est. total"
                      value={fmtMoney(info.totalEst || null)}
                    />
                    <StatMini
                      label="Unique names"
                      value={String(info.topSymbols.length)}
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Overlap table */}
          {selectedTargets.length >= 2 && (
            <Card className="p-0 border-border/60 bg-card/40 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60">
                <h2 className="text-sm font-medium">
                  Shared holdings
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tickers traded by two or more of the selected — where
                  consensus signals come from.
                </p>
              </div>
              {overlaps.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No tickers shared between these targets in the last
                  30 days.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                        <th className="px-5 py-2 font-medium">Symbol</th>
                        <th className="px-4 py-2 font-medium">
                          Traded by
                        </th>
                        <th className="px-4 py-2 font-medium">
                          Total trades
                        </th>
                        <th className="px-4 py-2 font-medium">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overlaps.map((o) => {
                        const symTrades = trades.filter(
                          (tr) => tr.symbol === o.symbol,
                        );
                        const buys = symTrades.filter(
                          (t) => t.side === "buy",
                        ).length;
                        const sells = symTrades.filter(
                          (t) => t.side === "sell",
                        ).length;
                        let verdict: "bullish" | "bearish" | "mixed" =
                          "mixed";
                        if (buys > 0 && sells === 0) verdict = "bullish";
                        else if (sells > 0 && buys === 0) verdict = "bearish";
                        return (
                          <tr
                            key={o.symbol}
                            className="border-b border-border/40 last:border-0"
                          >
                            <td className="px-5 py-2.5 font-mono">
                              {o.symbol}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {[...o.targetIds].map((tid) => {
                                  const t = selectedTargets.find(
                                    (x) => x.id === tid,
                                  );
                                  if (!t) return null;
                                  return (
                                    <Badge
                                      key={tid}
                                      variant="outline"
                                      className="text-[10px] py-0 h-4"
                                    >
                                      {t.display_name.split(" ").pop()}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 tabular-nums">
                              {o.totalTrades}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({buys}B / {sells}S)
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                variant="outline"
                                className={
                                  verdict === "bullish"
                                    ? "border-emerald-400/40 text-emerald-300 text-[10px] py-0 h-5"
                                    : verdict === "bearish"
                                      ? "border-rose-400/40 text-rose-300 text-[10px] py-0 h-5"
                                      : "text-[10px] py-0 h-5"
                                }
                              >
                                {verdict}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Alert className="px-5 py-4 border-border/60 bg-muted/20">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm leading-relaxed text-muted-foreground max-w-5xl">
          <b className="text-foreground">Not financial advice.</b>{" "}
          &ldquo;Shared holdings&rdquo; is a descriptive statistic, not
          a recommendation. Multiple smart-money investors arriving at
          the same name can mean conviction or coincidence. Always do
          your own work.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
