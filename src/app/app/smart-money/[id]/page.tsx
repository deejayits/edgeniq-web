import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Info, Clock, HardDriveDownload } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isEliteAccess } from "@/lib/access";
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
  // Count top-held names. Prefer real ticker when OpenFIGI resolved
  // one; fall back to the symbol column (cleaned company name) for
  // older rows or unresolved CUSIPs.
  const symbolCounts = new Map<string, number>();
  for (const t of trades) {
    const key = t.ticker ?? t.symbol;
    symbolCounts.set(key, (symbolCounts.get(key) ?? 0) + 1);
  }
  const topSymbols = [...symbolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

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
                {target.target_type === "politician"
                  ? "Official congress.gov profile"
                  : target.target_type === "fund_13f"
                    ? "SEC EDGAR filings"
                    : target.target_type === "insider"
                      ? "SEC Form 4 filings"
                      : "Public filings"}
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
              <h2 className="text-sm font-medium">Recent activity</h2>
              <p className="text-xs text-muted-foreground">
                {target.target_type === "fund_13f"
                  ? "13F positions disclosed by day — purple spike marks the quarterly filing"
                  : "Trades by day — buys (green) vs sells (red)"}
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
            {target.target_type === "fund_13f"
              ? "Largest positions"
              : "Most-traded tickers"}
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

      {/* Trade log — layout differs by target type because 13Fs and
          directional trades have different data semantics:
            fund_13f: quarterly holdings snapshot. No buy/sell per
              row, but we can show % of total portfolio. Sort by size.
            politician / insider / activist: directional (buy/sell)
              with trade + filed dates. Show both dates.
       */}
      {target.target_type === "fund_13f" ? (
        <FundHoldingsTable
          trades={trades}
          totalPortfolio={totalEstimate}
        />
      ) : (
        <DirectionalTradesTable trades={trades} targetType={target.target_type} />
      )}

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

// Extract the full issuer name from the trade's notes field.
// Ingestion appends '· {issuer_name}' to the notes string for 13F
// positions so we can render a humanized company name alongside
// the ticker. Returns null when the notes don't match that shape.
function parseCompanyFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  // Expected shape: "13F-HR · CUSIP XXX · 1,234 shares · ISSUER NAME"
  const parts = notes.split("·").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  return parts[parts.length - 1] || null;
}

// Position-change classification. We compute this at render time
// instead of storing it in the schema because:
//   1. It's purely derivable from the existing trade rows
//   2. Adding a column would require backfilling every historical
//      13F we've already ingested (and silently produce wrong
//      classifications for the oldest filings where we have no
//      "prior" snapshot)
//   3. Schema-free keeps the ingest path simple — the python writer
//      doesn't need to know about classification
//
// Logic:
//   - Group trades by filed_date; the two most recent dates are the
//     "current" and "prior" filings.
//   - For each ticker in the current filing:
//       not in prior        → "new"     — fresh conviction
//       in prior, size up   → "add_on"  — increased stake
//       in prior, size down → "trim"    → reduced stake
//       in prior, ~unchanged → "hold"   — no signal, not surfaced
//   - Tickers in prior but not in current = "exit" — surfaced separately
//
// Size-change threshold: 10% — below that we call it "hold" because
// 13F values fluctuate with price moves between filings and we don't
// want every position to read as "Add" / "Trim" purely from price drift.
type PositionChange = "new" | "add_on" | "trim" | "hold" | "exit";

const SIZE_CHANGE_THRESHOLD_PCT = 10;

function classifyHoldings(trades: SmartMoneyTrade[]): {
  classification: Map<string, { kind: PositionChange; deltaPct: number }>;
  exits: { symbol: string; size: number | null }[];
  hasPriorFiling: boolean;
} {
  // Group by filed_date — only consider rows that actually have one.
  const byFiledDate = new Map<string, SmartMoneyTrade[]>();
  for (const t of trades) {
    const fd = t.filed_date;
    if (!fd) continue;
    if (!byFiledDate.has(fd)) byFiledDate.set(fd, []);
    byFiledDate.get(fd)!.push(t);
  }
  const filedDates = [...byFiledDate.keys()].sort().reverse();
  if (filedDates.length === 0) {
    return { classification: new Map(), exits: [], hasPriorFiling: false };
  }
  const current = byFiledDate.get(filedDates[0]) ?? [];
  const prior = filedDates[1] ? byFiledDate.get(filedDates[1]) ?? [] : [];

  const priorByTicker = new Map<string, number>();
  for (const t of prior) {
    const key = (t.ticker ?? t.symbol ?? "").toUpperCase();
    if (!key) continue;
    priorByTicker.set(key, (priorByTicker.get(key) ?? 0) + (t.size_estimate_usd ?? 0));
  }

  const classification = new Map<string, { kind: PositionChange; deltaPct: number }>();
  const seenInCurrent = new Set<string>();
  for (const t of current) {
    const key = (t.ticker ?? t.symbol ?? "").toUpperCase();
    if (!key) continue;
    seenInCurrent.add(key);
    const currentSize = t.size_estimate_usd ?? 0;
    const priorSize = priorByTicker.get(key) ?? 0;
    if (priorSize === 0) {
      classification.set(key, { kind: "new", deltaPct: 100 });
      continue;
    }
    const deltaPct = ((currentSize - priorSize) / priorSize) * 100;
    if (deltaPct > SIZE_CHANGE_THRESHOLD_PCT) {
      classification.set(key, { kind: "add_on", deltaPct });
    } else if (deltaPct < -SIZE_CHANGE_THRESHOLD_PCT) {
      classification.set(key, { kind: "trim", deltaPct });
    } else {
      classification.set(key, { kind: "hold", deltaPct });
    }
  }

  const exits: { symbol: string; size: number | null }[] = [];
  for (const t of prior) {
    const key = (t.ticker ?? t.symbol ?? "").toUpperCase();
    if (!key || seenInCurrent.has(key)) continue;
    if (!exits.some((e) => e.symbol === key)) {
      exits.push({ symbol: key, size: t.size_estimate_usd ?? null });
    }
  }

  return {
    classification,
    exits,
    hasPriorFiling: filedDates.length >= 2,
  };
}

const POSITION_CHANGE_BADGE: Record<
  PositionChange,
  { label: string; className: string } | null
> = {
  new: {
    label: "New",
    className: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
  },
  add_on: {
    label: "Add",
    className: "border-emerald-400/30 text-emerald-300/90 bg-emerald-400/5",
  },
  trim: {
    label: "Trim",
    className: "border-amber-400/30 text-amber-300 bg-amber-400/5",
  },
  hold: null, // intentionally not surfaced — no signal
  exit: {
    label: "Exit",
    className: "border-rose-400/30 text-rose-300 bg-rose-400/5",
  },
};

// Fund 13F table — snapshot of holdings as of the quarterly filing.
// No buy/sell column because 13F doesn't disclose direction; instead
// we show % of total disclosed portfolio so users can see relative
// conviction at a glance.
function FundHoldingsTable({
  trades,
  totalPortfolio,
}: {
  trades: SmartMoneyTrade[];
  totalPortfolio: number;
}) {
  // Limit "current filing" to the most recent filed_date and sort by
  // size. Older snapshots stay in `trades` for classification but
  // shouldn't appear as separate rows in the holdings table.
  const { classification, exits, hasPriorFiling } = classifyHoldings(trades);
  const filedDates = [
    ...new Set(trades.map((t) => t.filed_date).filter(Boolean) as string[]),
  ].sort().reverse();
  const latestFiledDate = filedDates[0] ?? null;
  const currentRows = latestFiledDate
    ? trades.filter((t) => t.filed_date === latestFiledDate)
    : trades;
  const sorted = [...currentRows].sort(
    (a, b) => (b.size_estimate_usd ?? 0) - (a.size_estimate_usd ?? 0),
  );
  return (
    <Card className="p-0 border-border/60 bg-card/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">13F Holdings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasPriorFiling
              ? "Latest quarterly filing — Change column shows movement vs prior quarter"
              : "Positions disclosed in the latest quarterly filing, sorted by size"}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {sorted.length} positions
        </Badge>
      </div>
      {sorted.length === 0 ? (
        <EmptyTradesState targetType="fund_13f" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Ticker</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">
                  {hasPriorFiling ? "Change" : ""}
                </th>
                <th className="px-4 py-2 font-medium text-right">Size</th>
                <th className="px-4 py-2 font-medium text-right">
                  % of portfolio
                </th>
                <th className="px-4 py-2 font-medium">Filed</th>
                <th className="px-4 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 50).map((t) => {
                const pct =
                  totalPortfolio > 0 && t.size_estimate_usd
                    ? (t.size_estimate_usd / totalPortfolio) * 100
                    : 0;
                // Prefer real ticker (from OpenFIGI); fall back to
                // cleaned company name in the symbol column. For the
                // Company column we use the full name from notes
                // when available, or the symbol itself.
                const displayTicker = t.ticker ?? t.symbol;
                // Parse the fuller company name out of the notes
                // field (ingestion appends " · {full_issuer_name}")
                // so humans recognize "Alphabet Inc" vs "GOOGL".
                const companyName = parseCompanyFromNotes(t.notes) ?? t.symbol;
                const classKey = (t.ticker ?? t.symbol ?? "").toUpperCase();
                const change = classification.get(classKey);
                const badge = change ? POSITION_CHANGE_BADGE[change.kind] : null;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-5 py-2.5 font-mono">
                      {t.ticker ? (
                        <span className="text-foreground">{displayTicker}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {displayTicker}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {companyName}
                    </td>
                    <td className="px-4 py-2.5">
                      {badge ? (
                        <span
                          className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.className}`}
                        >
                          {badge.label}
                          {(change?.kind === "add_on" || change?.kind === "trim") &&
                          change.deltaPct !== 0 ? (
                            <span className="ml-1 opacity-80 tabular-nums">
                              {change.deltaPct > 0 ? "+" : ""}
                              {change.deltaPct.toFixed(0)}%
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-right">
                      {t.size_estimate_usd != null
                        ? fmtMoney(t.size_estimate_usd)
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-right text-muted-foreground">
                      {pct > 0 ? `${pct.toFixed(2)}%` : "—"}
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
          {sorted.length > 50 && (
            <div className="px-5 py-3 text-xs text-muted-foreground border-t border-border/60 bg-muted/10">
              Showing top 50 of {sorted.length} positions by size.
            </div>
          )}
          {exits.length > 0 && (
            <div className="px-5 py-4 text-xs border-t border-border/60 bg-rose-500/5">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-rose-300 font-medium uppercase tracking-wider">
                  Exits this filing
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {exits.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {exits.slice(0, 30).map((e) => (
                  <span
                    key={e.symbol}
                    className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-200 bg-rose-400/5"
                    title={
                      e.size != null
                        ? `Last filed size: ${fmtMoney(e.size)}`
                        : "Position no longer in latest filing"
                    }
                  >
                    {e.symbol}
                  </span>
                ))}
                {exits.length > 30 && (
                  <span className="text-muted-foreground">
                    +{exits.length - 30} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Politician / insider / activist table — directional trades.
function DirectionalTradesTable({
  trades,
  targetType,
}: {
  trades: SmartMoneyTrade[];
  targetType: TargetType;
}) {
  return (
    <Card className="p-0 border-border/60 bg-card/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60">
        <h2 className="text-sm font-medium">Recent trades</h2>
      </div>
      {trades.length === 0 ? (
        <EmptyTradesState targetType={targetType} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Symbol</th>
                <th className="px-4 py-2 font-medium">Action</th>
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
                const actionLabel =
                  t.side === "buy"
                    ? "Bought"
                    : t.side === "sell"
                      ? "Sold"
                      : t.side === "exchange"
                        ? "Exchanged"
                        : "Disclosed";
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
                        {actionLabel}
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
  );
}

// Differentiated empty state for the trades table. Politicians get a
// "Coming soon" treatment — we don't have a data source wired yet so
// the empty isn't going to resolve on its own. Funds get a shorter
// "Data ingestion pending" message — the SEC cron will populate on
// its next run, so the empty is genuinely temporary.
function EmptyTradesState({ targetType }: { targetType: TargetType }) {
  if (targetType === "politician") {
    return (
      <div className="px-6 py-12 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-violet-400/10 border border-violet-400/30 flex items-center justify-center mx-auto">
          <Clock className="h-5 w-5 text-violet-300" />
        </div>
        <div>
          <Badge className="bg-violet-400/15 text-violet-300 border border-violet-400/30 mb-2">
            Coming soon
          </Badge>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Congressional trade ingestion is on the roadmap. Your
            profile and follow button work today — alerts will turn
            on once data lands.
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
          In the meantime, hedge fund 13F filings already populate —
          browse those for live data.
        </p>
      </div>
    );
  }
  if (targetType === "insider" || targetType === "activist") {
    return (
      <div className="px-6 py-12 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto">
          <Clock className="h-5 w-5 text-amber-300" />
        </div>
        <div>
          <Badge className="bg-amber-400/15 text-amber-300 border border-amber-400/30 mb-2">
            Coming soon
          </Badge>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {targetType === "insider"
              ? "Form 4 insider-trade ingestion is planned for a future release. Form 4 has a 2-day filing deadline so this would be our fastest-latency data source."
              : "Activist 13D/13G filings — reported within 10 days of a 5%+ stake — are on the roadmap."}
          </p>
        </div>
      </div>
    );
  }
  // fund_13f — ingestion IS wired but may not have run yet
  return (
    <div className="px-6 py-12 text-center space-y-3">
      <div className="h-12 w-12 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center mx-auto">
        <HardDriveDownload className="h-5 w-5 text-emerald-300" />
      </div>
      <div>
        <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 mb-2">
          Ingestion pending
        </Badge>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          13F ingestion runs nightly against SEC EDGAR. Positions for
          this fund will appear after the next cron tick. If this has
          been empty more than 48 hours, the fund may not have filed a
          13F-HR in the current reporting window.
        </p>
      </div>
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
