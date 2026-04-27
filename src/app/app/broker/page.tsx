import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isEliteAccess } from "@/lib/access";
import { HeaderStat } from "@/components/header-stat";
import { ConnectForm } from "./connect-form";
import { ConnectionStrip } from "./connection-strip";
import { RulesCard, type RuleRow } from "./rules-card";
import { RiskRailsCard, type RiskRailsRow } from "./risk-rails-card";
import { AutoTradeMasterToggle } from "./master-toggle";
import { MasterKillSwitch } from "./master-kill-switch";
import { InactiveModeBanner } from "./inactive-mode-banner";
import { LiveView, type LiveUserState, type LiveConnection } from "./live-view";

export const dynamic = "force-dynamic";

// Auto-trading via Alpaca. Two modes coexist as separate broker
// connections (paper / live) but only ONE is the order-routing
// target at a time — users.active_broker_mode is the single source
// of truth. Paper is the default and safe baseline; live requires
// the Live Trading add-on plus a multi-step opt-in.

type BrokerConnection = {
  chat_id: number;
  broker: string;
  mode: string;
  auth_method: string;
  account_id: string | null;
  account_status: string | null;
  buying_power_at_connect: number | null;
  is_active: boolean;
  connected_at: string;
};

type TradeRow = {
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

export default async function BrokerPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await auth();
  const user = session?.user as
    | {
        tgUserId?: number;
        role?: string;
        subPlan?: string;
      }
    | undefined;
  if (!user?.tgUserId) redirect("/login?next=/app/broker");

  const params = await searchParams;
  // ?mode= controls which TAB is shown (visual). It does NOT change
  // active_broker_mode (the routing target). Default to whatever the
  // user's actual active mode is so the URL reflects what's live.
  const requestedTab =
    params.mode === "live" || params.mode === "paper" ? params.mode : null;

  const supabase = supabaseAdmin();

  // Local row type — Supabase's generated types don't yet include
  // the live_* columns added by 20260427140000_alpaca_live_mode.sql.
  // The shape here mirrors the migration. Once codegen runs against
  // the updated schema, this cast becomes redundant.
  type UserRowExt = {
    sub_plan: string | null;
    sub_status: string | null;
    addon_live_trading: boolean | null;
    live_trading_enabled: boolean | null;
    live_acknowledged_at: string | null;
    live_acknowledged_version: number | null;
    live_max_position_usd: number | null;
    live_max_daily_loss_usd: number | null;
    live_max_open_positions: number | null;
    live_confirmation_level: "strict" | "standard" | null;
    active_broker_mode: "paper" | "live" | null;
  };

  // Pull the full user row — we need many fields for live-mode gating.
  const { data: userRowRaw } = await supabase
    .from("users")
    .select(
      "sub_plan, sub_status, addon_live_trading, " +
        "live_trading_enabled, live_acknowledged_at, live_acknowledged_version, " +
        "live_max_position_usd, live_max_daily_loss_usd, live_max_open_positions, " +
        "live_confirmation_level, active_broker_mode",
    )
    .eq("chat_id", user.tgUserId)
    .maybeSingle();
  const userRow = (userRowRaw as unknown) as UserRowExt | null;

  const eliteish = isEliteAccess({
    role: user.role,
    subPlan: userRow?.sub_plan ?? user.subPlan,
    subStatus: userRow?.sub_status ?? undefined,
  });

  if (!eliteish) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Auto-trading
        </h1>
        <Card className="p-8 text-center border-border/60 bg-card/40 space-y-3">
          <Badge className="bg-violet-400/15 text-violet-300 border border-violet-400/30">
            Elite feature
          </Badge>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect your Alpaca paper account and let EdgeNiq place
            trades on signals that match your rules. Upgrade to Elite
            to enable.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/#pricing">See pricing</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Load connection + rules + rails + today's trades in parallel.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [connsRes, rulesRes, railsRes, tradesRes] = await Promise.all([
    // Pull BOTH paper and live connections — page renders the right
    // one based on which tab is active. .maybeSingle() is wrong now
    // that two rows can match.
    supabase
      .from("broker_connections")
      .select(
        "chat_id, broker, mode, auth_method, account_id, account_status, buying_power_at_connect, is_active, connected_at",
      )
      .eq("chat_id", user.tgUserId)
      .eq("broker", "alpaca")
      .eq("is_active", true),
    supabase
      .from("auto_trade_rules")
      .select("*")
      .eq("chat_id", user.tgUserId),
    supabase
      .from("auto_trade_risk_rails")
      .select("*")
      .eq("chat_id", user.tgUserId)
      .maybeSingle(),
    supabase
      .from("auto_trades")
      .select(
        "id, symbol, side, qty, status, avg_fill_price, submitted_at, filled_at, order_class, mode, error_message",
      )
      .eq("chat_id", user.tgUserId)
      .gte("submitted_at", todayStart.toISOString())
      .order("submitted_at", { ascending: false })
      .limit(50),
  ]);

  const conns = ((connsRes.data ?? []) as unknown) as BrokerConnection[];
  const paperConn = conns.find((c) => c.mode === "paper") ?? null;
  const liveConn = conns.find((c) => c.mode === "live") ?? null;
  const allRules = ((rulesRes.data ?? []) as unknown) as RuleRow[];
  // Partition rules per mode. The bot evaluates rules filtered by
  // users.active_broker_mode; the web mirrors that — each tab edits
  // its own rule set.
  const paperRules = allRules.filter((r) => r.mode === "paper");
  const liveRules = allRules.filter((r) => r.mode === "live");
  const rails = (railsRes.data as unknown) as RiskRailsRow | null;
  const trades = ((tradesRes.data ?? []) as unknown) as TradeRow[];

  // Resolve which tab to show. Priority: explicit ?mode= URL param,
  // then user's active mode, then paper as the safe default.
  const activeMode: "paper" | "live" =
    (userRow?.active_broker_mode as "paper" | "live" | null) ?? "paper";
  const visibleTab: "paper" | "live" = requestedTab ?? activeMode;

  // Live state bundle — passed down to LiveView for the state machine
  // resolution. Admin role bypass for the addon entitlement matches
  // the bot-side has_elite_access pattern.
  const isAdmin = user.role === "admin" || user.role === "primary_admin";
  const liveUserState: LiveUserState = {
    hasAddon: !!userRow?.addon_live_trading || isAdmin,
    liveTradingEnabled: !!userRow?.live_trading_enabled,
    liveAcknowledgedAt: userRow?.live_acknowledged_at ?? null,
    liveAcknowledgedVersion: userRow?.live_acknowledged_version ?? 0,
    activeBrokerMode: activeMode,
    liveMaxPositionUsd: Number(userRow?.live_max_position_usd ?? 100),
    liveMaxDailyLossUsd: Number(userRow?.live_max_daily_loss_usd ?? 200),
    liveMaxOpenPositions: Number(userRow?.live_max_open_positions ?? 2),
    liveConfirmationLevel:
      (userRow?.live_confirmation_level as "strict" | "standard") ?? "strict",
  };
  const liveConnSummary: LiveConnection = liveConn
    ? {
        account_id: liveConn.account_id,
        account_status: liveConn.account_status,
        buying_power_at_connect: liveConn.buying_power_at_connect,
        connected_at: liveConn.connected_at,
      }
    : null;

  // Per-tab rule lookups. visibleTab determines which rule set the
  // page renders; the OTHER tab's rules are intentionally untouched.
  const tabRules = visibleTab === "live" ? liveRules : paperRules;
  const stockRule =
    tabRules.find((r) => r.signal_type === "stocks") ??
    defaultRule("stocks", visibleTab);
  const optionsRule =
    tabRules.find((r) => r.signal_type === "options") ??
    defaultRule("options", visibleTab);

  // Right-rail stats for the header. The "Active rules" count
  // reflects rules in the *currently active routing mode* — that
  // mirrors what the bot will actually evaluate when a signal fires.
  const todaysOrders = trades.length;
  const activeModeRules = activeMode === "live" ? liveRules : paperRules;
  const activeRulesCount = activeModeRules.filter(
    (r) => r.execution_mode === "auto" || r.execution_mode === "one_tap",
  ).length;
  const activeModeTotal = activeModeRules.length || 2;
  // Per-visible-tab counts so the AutoTradeMasterToggle inside each
  // tab reflects only that tab's rules. Toggling Paper toggle never
  // changes Live state and vice versa.
  const tabActiveCount = tabRules.filter(
    (r) => r.execution_mode === "auto" || r.execution_mode === "one_tap",
  ).length;
  const tabAnyActive = tabActiveCount > 0;
  const tabTotal = tabRules.length || 2;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_oklch(0.488_0.243_264.376_/_0.6)]" />
            Execution
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Auto-trading
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            Connect Alpaca and let EdgeNiq place trades on qualifying
            signals. Paper is the default; Live is opt-in only.
          </p>
        </div>
        <div className="flex items-stretch gap-3">
          {/* Active Mode tile = the actual order-routing target
              (users.active_broker_mode). It reflects WHERE orders go
              when a signal fires, independent of whether any rule is
              currently auto. The "Active rules" tile next to it
              carries the on/off state of auto-trade itself; keeping
              the two concepts visually separate stops the user from
              reading "no rules running" as "live mode is off". */}
          <HeaderStat
            label="Active mode"
            value={activeMode === "live" ? "LIVE" : "Paper"}
            sub={
              activeMode === "live"
                ? "real money routing"
                : "no risk routing"
            }
            tone={activeMode === "live" ? "rose" : "primary"}
          />
          <HeaderStat
            label="Active rules"
            value={
              activeRulesCount === 0 ? "Off" : `${activeRulesCount}`
            }
            sub={
              activeRulesCount === 0
                ? "auto-trade paused"
                : `of ${activeModeTotal} on ${activeMode}`
            }
            tone={activeRulesCount > 0 ? "primary" : "muted"}
          />
          <HeaderStat
            label="Orders today"
            value={`${todaysOrders}`}
            sub={
              todaysOrders === 0
                ? "none yet"
                : todaysOrders === 1
                  ? "1 order"
                  : "submitted"
            }
            tone="muted"
          />
        </div>
      </header>

      {/* Tabs row — tabs on left for visual selection (does NOT
          change active_broker_mode), master kill switch on right
          (always reachable from any tab, kills both paper + live in
          one click). Visual + routing state decoupled on purpose. */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ModeTabs activeMode={activeMode} visibleTab={visibleTab} />
        <MasterKillSwitch
          engaged={rails?.kill_switch_engaged ?? false}
          engagedAt={rails?.kill_switch_engaged_at ?? null}
          reason={rails?.kill_switch_engaged_reason ?? null}
        />
      </div>

      {visibleTab === "live" ? (
        <LiveView
          user={liveUserState}
          liveConn={liveConnSummary}
          isActiveRoutingMode={activeMode === "live"}
          rulesContext={{
            anyActive: tabAnyActive,
            activeCount: tabActiveCount,
            totalCount: tabTotal,
          }}
        />
      ) : !paperConn ? (
        <Card className="p-6 border-border/60 bg-card/40">
          <h2 className="font-medium mb-4">Connect Alpaca</h2>
          <ConnectForm />
        </Card>
      ) : (
        <>
          {/* Inactive-mode banner — visible only when this paper tab
              is NOT the current routing target. Tells the user their
              changes are saved-as-config and won't fire until they
              switch back to paper. */}
          {activeMode !== "paper" && (
            <InactiveModeBanner
              visibleTab="paper"
              activeMode={activeMode}
            />
          )}

          {/* Compact connection strip (replaces the centered card) */}
          <ConnectionStrip
            mode="paper"
            isActive={activeMode === "paper"}
            accountId={paperConn.account_id}
            accountStatus={paperConn.account_status}
            buyingPower={paperConn.buying_power_at_connect}
            connectedAt={paperConn.connected_at}
          />

          <Alert className="px-5 py-4 border-border/60 bg-muted/20">
            <AlertDescription className="text-sm leading-relaxed text-muted-foreground max-w-5xl">
              <b className="text-foreground">Not financial advice.</b> You
              are responsible for every trade EdgeNiq submits on your
              behalf. Review your rules, set risk rails, and keep the
              kill switch accessible (top right).
            </AlertDescription>
          </Alert>

          {/* Auto-trade master toggle. Kill switch lives at page
              level (next to the tabs) so it's reachable from any
              tab. Pairing them in a grid here would duplicate the
              kill control — drop the duplicate, keep the toggle
              full-width since it's now solo. */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Auto-trade
            </h2>
            <AutoTradeMasterToggle
              mode="paper"
              isActiveRoutingMode={activeMode === "paper"}
              anyActive={tabAnyActive}
              activeCount={tabActiveCount}
              totalCount={tabTotal}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Risk rails
            </h2>
            <RiskRailsCard
              rails={
                rails ?? {
                  chat_id: user.tgUserId!,
                  max_open_positions: 5,
                  max_alloc_per_ticker_pct: 20,
                  max_daily_loss_usd: null,
                  max_daily_loss_pct: null,
                }
              }
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Rules
            </h2>
            <div className="grid lg:grid-cols-2 gap-4 items-stretch">
              <RulesCard
                rule={stockRule}
                title="Stock signals"
                description="Auto-trade stock signals against your watchlist."
              />
              <RulesCard
                rule={optionsRule}
                title="Options signals"
                description="Auto-trade OPTIONS SIGNAL alerts. Start small — premiums decay fast."
              />
            </div>
          </section>

          <TradesTable trades={trades} />
        </>
      )}
    </div>
  );
}

// Mode tabs at the top of /app/broker. Pill-style segmented control.
// Visual selector only — picking a tab does NOT call any action.
// The "ACTIVE" pill inside a tab indicates which mode is currently
// the order-routing target (users.active_broker_mode), which may
// differ from which tab the user is currently viewing.
function ModeTabs({
  activeMode,
  visibleTab,
}: {
  activeMode: "paper" | "live";
  visibleTab: "paper" | "live";
}) {
  const tabs: { mode: "paper" | "live"; label: string }[] = [
    { mode: "paper", label: "Paper" },
    { mode: "live", label: "Live" },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-card/40 rounded-lg border border-border/60">
      {tabs.map((t) => {
        const isVisible = visibleTab === t.mode;
        const isActive = activeMode === t.mode;
        const isLive = t.mode === "live";
        return (
          <Link
            key={t.mode}
            href={`/app/broker?mode=${t.mode}`}
            scroll={false}
            className={`px-5 py-2 text-sm font-medium rounded-md transition inline-flex items-center gap-2 ${
              isVisible
                ? isLive
                  ? "bg-rose-500/15 text-rose-200 border border-rose-500/40"
                  : "bg-primary/15 text-primary border border-primary/40"
                : "text-muted-foreground border border-transparent hover:text-foreground hover:bg-muted/30"
            }`}
          >
            {t.label}
            {/* "ACTIVE" pill shows which mode is currently routing
                orders. Visible from either tab so a user on Paper
                still sees "Live" tagged active when applicable. */}
            {isActive && (
              <span
                className={`text-[9px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded ${
                  isLive
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-emerald-400/20 text-emerald-300"
                }`}
              >
                Active
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function defaultRule(
  signalType: "stocks" | "options",
  mode: "paper" | "live",
): RuleRow {
  return {
    chat_id: 0,
    signal_type: signalType,
    mode,
    execution_mode: "off",
    min_score: signalType === "options" ? 80 : 75,
    watchlist_only: true,
    position_size_type: "dollar_fixed",
    position_size_value: signalType === "options" ? 200 : 500,
    max_daily_orders: 5,
    cooldown_minutes: 0,
  };
}

function TradesTable({ trades }: { trades: TradeRow[] }) {
  if (trades.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Today&rsquo;s auto-trades
        </h2>
        <Card className="p-8 border-border/60 bg-card/40 text-center">
          <p className="text-sm text-muted-foreground">
            No trades submitted today. Enable a rule and wait for a
            matching signal.
          </p>
        </Card>
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Today&rsquo;s auto-trades
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {trades.length}{" "}
          {trades.length === 1 ? "order" : "orders"}
        </span>
      </div>
      <Card className="p-0 border-border/60 bg-card/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
              <th className="px-5 py-2 font-medium">Symbol</th>
              <th className="px-4 py-2 font-medium">Side</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Fill</th>
              <th className="px-4 py-2 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
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
                        : "border-rose-400/40 text-rose-300 text-[10px] py-0 h-5"
                    }
                  >
                    {t.side}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{t.qty}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-[10px] py-0 h-5">
                    {t.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {t.avg_fill_price != null
                    ? `$${Number(t.avg_fill_price).toFixed(2)}`
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {new Date(t.submitted_at).toLocaleTimeString([], {
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
  );
}
