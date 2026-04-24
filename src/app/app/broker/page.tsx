import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ConnectForm } from "./connect-form";
import { ConnectedHeader } from "./connected-header";
import { RulesCard, type RuleRow } from "./rules-card";
import { RiskRailsCard, type RiskRailsRow } from "./risk-rails-card";
import { KillSwitchCard } from "./kill-switch-card";

export const dynamic = "force-dynamic";

// Paper-only auto-trading via Alpaca. Elite-tier feature (paper-mode
// is in Elite; live-mode will be its own tier when it ships).

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

export default async function BrokerPage() {
  const session = await auth();
  const user = session?.user as
    | {
        tgUserId?: number;
        role?: string;
        subPlan?: string;
      }
    | undefined;
  if (!user?.tgUserId) redirect("/login?next=/app/broker");

  const supabase = supabaseAdmin();

  // Fetch the user's sub_status server-side (session only carries plan,
  // not status, so we look it up here for the gate).
  const { data: userRow } = await supabase
    .from("users")
    .select("sub_plan, sub_status")
    .eq("chat_id", user.tgUserId)
    .maybeSingle();

  const eliteish = isEliteAccess({
    role: user.role,
    subPlan: userRow?.sub_plan ?? user.subPlan,
    subStatus: userRow?.sub_status,
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

  const [connRes, rulesRes, railsRes, tradesRes] = await Promise.all([
    supabase
      .from("broker_connections")
      .select(
        "chat_id, broker, mode, auth_method, account_id, account_status, buying_power_at_connect, is_active, connected_at",
      )
      .eq("chat_id", user.tgUserId)
      .eq("broker", "alpaca")
      .eq("is_active", true)
      .maybeSingle(),
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

  const conn = connRes.data as BrokerConnection | null;
  const rules = ((rulesRes.data ?? []) as unknown) as RuleRow[];
  const rails = (railsRes.data as unknown) as RiskRailsRow | null;
  const trades = ((tradesRes.data ?? []) as unknown) as TradeRow[];

  const stockRule =
    rules.find((r) => r.signal_type === "stocks") ?? defaultRule("stocks");
  const optionsRule =
    rules.find((r) => r.signal_type === "options") ?? defaultRule("options");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Auto-trading
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Alpaca paper account and let EdgeNiq place
          trades on qualifying signals. Paper mode only for now — no
          real money at risk.
        </p>
      </div>

      {!conn ? (
        <Card className="p-6 border-border/60 bg-card/40">
          <h2 className="font-medium mb-4">Connect Alpaca</h2>
          <ConnectForm />
        </Card>
      ) : (
        <>
          <ConnectedHeader
            accountId={conn.account_id}
            accountStatus={conn.account_status}
            buyingPower={conn.buying_power_at_connect}
            connectedAt={conn.connected_at}
          />

          <Alert className="border-border/60 bg-muted/20">
            <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
              <b className="text-foreground">Not financial advice.</b> You
              are responsible for every trade EdgeNiq submits on your
              behalf. Review your rules, set risk rails, and keep the
              kill switch accessible.
            </AlertDescription>
          </Alert>

          <KillSwitchCard
            engaged={rails?.kill_switch_engaged ?? false}
            engagedAt={rails?.kill_switch_engaged_at ?? null}
            reason={rails?.kill_switch_engaged_reason ?? null}
          />

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

          <div className="grid lg:grid-cols-2 gap-4">
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

          <TradesTable trades={trades} />
        </>
      )}
    </div>
  );
}

function defaultRule(signalType: "stocks" | "options"): RuleRow {
  return {
    chat_id: 0,
    signal_type: signalType,
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
      <Card className="p-6 border-border/60 bg-card/40">
        <h2 className="font-medium">Today&rsquo;s auto-trades</h2>
        <p className="text-xs text-muted-foreground mt-2">
          No trades submitted today. Enable a rule and wait for a
          matching signal.
        </p>
      </Card>
    );
  }
  return (
    <Card className="p-0 border-border/60 bg-card/40 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/60">
        <h2 className="font-medium">Today&rsquo;s auto-trades</h2>
      </div>
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
  );
}
