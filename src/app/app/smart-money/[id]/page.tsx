import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ActivityChart } from "../activity-chart";
import { FollowControls } from "../follow-controls";
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

function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isEliteAccess(user: {
  role?: string;
  subPlan?: string;
  subStatus?: string;
}): boolean {
  if (user.role === "admin" || user.role === "primary_admin") return true;
  const status = (user.subStatus ?? "").toLowerCase();
  if (status === "expired") return false;
  if (status === "trial") return true;
  return (user.subPlan ?? "").toLowerCase() === "elite";
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function daysAgo(iso: string): string {
  const d = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000,
  );
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  const months = Math.floor(d / 30);
  return `${months}mo ago`;
}

export default async function TargetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const user = session?.user as
    | { tgUserId?: number; role?: string; subPlan?: string }
    | undefined;
  const { id } = await params;
  if (!user?.tgUserId) redirect(`/login?next=/app/smart-money/${id}`);

  const supabase = supabaseAdmin();

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
  if (!eliteish) redirect("/app/smart-money");

  const hasLiveAddon =
    !!userRow?.addon_live_trading ||
    user.role === "admin" ||
    user.role === "primary_admin";

  const [targetRes, tradesRes, followRes] = await Promise.all([
    supabase
      .from("smart_money_targets")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("smart_money_trades")
      .select("*")
      .eq("target_id", id)
      .order("trade_date", { ascending: false })
      .limit(50),
    supabase
      .from("smart_money_follows")
      .select("*")
      .eq("chat_id", user.tgUserId)
      .eq("target_id", id)
      .maybeSingle(),
  ]);

  const target = targetRes.data as SmartMoneyTarget | null;
  if (!target) notFound();
  const trades = (tradesRes.data ?? []) as SmartMoneyTrade[];
  const follow = followRes.data as
    | { alert_on_trades: boolean; mimic_on_trades: boolean }
    | null;

  // Aggregate stats
  const buys = trades.filter((t) => t.side === "buy").length;
  const sells = trades.filter((t) => t.side === "sell").length;
  const totalEstimate = trades.reduce(
    (sum, t) => sum + (t.size_estimate_usd ?? 0),
    0,
  );
  const symbolCounts = new Map<string, number>();
  for (const t of trades) {
    symbolCounts.set(t.symbol, (symbolCounts.get(t.symbol) ?? 0) + 1);
  }
  const topSymbols = [...symbolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link href="/app/smart-money">
            <ArrowLeft className="h-3 w-3" />
            All smart money
          </Link>
        </Button>
      </div>

      {/* Header */}
      <Card className="p-6 border-border/60 bg-card/40">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-emerald-400/15 to-violet-400/15 border border-border/60 flex items-center justify-center text-xl font-semibold shrink-0">
            {target.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={target.avatar_url}
                alt={target.display_name}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              avatarInitials(target.display_name)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {target.display_name}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs ${TYPE_ACCENT[target.target_type]}`}
              >
                {TARGET_TYPE_LABEL[target.target_type]}
              </Badge>
            </div>
            {target.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">
                {target.subtitle}
              </p>
            )}
            {target.reference_url && (
              <a
                href={target.reference_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                Source filings
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total trades" value={trades.length.toString()} />
        <StatTile label="Buys · Sells" value={`${buys} · ${sells}`} />
        <StatTile
          label="Est. total"
          value={fmtMoney(totalEstimate || null)}
          hint={
            target.target_type === "politician"
              ? "approximate (House bucket midpoints)"
              : "from disclosed fair value"
          }
        />
        <StatTile
          label="Last trade"
          value={
            trades.length > 0 ? daysAgo(trades[0].trade_date) : "—"
          }
        />
      </div>

      {/* Activity chart */}
      {trades.length > 0 && (
        <Card className="p-5 border-border/60 bg-card/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium">30-day activity</h2>
              <p className="text-xs text-muted-foreground">
                Trade count by day · buys (green) vs sells (red)
              </p>
            </div>
          </div>
          <ActivityChart trades={trades} />
        </Card>
      )}

      {/* Follow controls */}
      <FollowControls
        targetId={target.id}
        displayName={target.display_name}
        isFollowed={!!follow}
        alertOnTrades={follow?.alert_on_trades ?? false}
        mimicOnTrades={follow?.mimic_on_trades ?? false}
        hasLiveAddon={hasLiveAddon}
      />

      {/* Top holdings by trade count */}
      {topSymbols.length > 0 && (
        <Card className="p-5 border-border/60 bg-card/40">
          <h2 className="text-sm font-medium mb-3">
            Most-traded tickers
          </h2>
          <div className="flex flex-wrap gap-2">
            {topSymbols.map(([sym, count]) => (
              <Badge
                key={sym}
                variant="outline"
                className="font-mono border-border/60"
              >
                {sym}{" "}
                <span className="ml-1 text-muted-foreground">×{count}</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Trade log */}
      <Card className="p-0 border-border/60 bg-card/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-sm font-medium">Recent trades</h2>
        </div>
        {trades.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No trades on file yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Symbol</th>
                  <th className="px-4 py-2 font-medium">Side</th>
                  <th className="px-4 py-2 font-medium">Size</th>
                  <th className="px-4 py-2 font-medium">Traded</th>
                  <th className="px-4 py-2 font-medium">Filed</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const size =
                    t.size_estimate_usd != null
                      ? fmtMoney(t.size_estimate_usd)
                      : t.size_bucket ?? "—";
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="px-5 py-2.5 font-mono">{t.symbol}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            t.side === "buy"
                              ? "border-emerald-400/40 text-emerald-300 text-[10px] py-0 h-5"
                              : t.side === "sell"
                                ? "border-rose-400/40 text-rose-300 text-[10px] py-0 h-5"
                                : "text-[10px] py-0 h-5"
                          }
                        >
                          {t.side}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{size}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {t.trade_date} ({daysAgo(t.trade_date)})
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {t.filed_date ?? "pending"}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {t.source_url ? (
                          <a
                            href={t.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            link
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Alert className="border-border/60 bg-muted/20">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
          <b className="text-foreground">Not financial advice.</b> Data
          sourced from public SEC EDGAR + Congressional disclosure
          feeds. Congressional filings have a 30-45 day reporting
          delay — you&rsquo;re seeing what they disclosed, not
          real-time activity.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4 border-border/60 bg-card/40">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
      {hint && (
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
          {hint}
        </p>
      )}
    </Card>
  );
}
