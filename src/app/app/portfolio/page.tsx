import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabaseAdmin } from "@/lib/supabase/server";

// Portfolio view — active personal trades + recent closed. Scoped to
// the authenticated user via tgUserId claim.
export default async function PortfolioPage() {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!tgUserId) return null;

  const db = supabaseAdmin();
  const { data: trades } = await db
    .from("personal_trades")
    .select("*")
    .eq("chat_id", tgUserId)
    .order("confirmed_at", { ascending: false })
    .limit(50);

  const active = (trades ?? []).filter((t) => t.status === "active");
  const closed = (trades ?? []).filter((t) => t.status === "closed");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your confirmed personal trades, active and recently closed.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <Card className="p-8 border-border/60 bg-card/50 text-center">
            <p className="text-sm text-muted-foreground">
              No active trades. Confirm a signal from Telegram and it
              shows up here.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {active.map((t) => (
              <TradeRow key={t.personal_trade_id} trade={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Recently closed ({closed.length})
        </h2>
        {closed.length === 0 ? (
          <Card className="p-8 border-border/60 bg-card/50 text-center">
            <p className="text-sm text-muted-foreground">
              No closed trades yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {closed.slice(0, 20).map((t) => (
              <TradeRow key={t.personal_trade_id} trade={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type Trade = {
  personal_trade_id: string;
  ticker: string;
  user_entry_price: number;
  confirmed_at: string;
  status: string;
  outcome: string | null;
  user_pnl_pct: number | null;
  risk_profile: string;
};

function TradeRow({ trade }: { trade: Trade }) {
  const isWin =
    trade.outcome && /t[0-9]_hit|full_target_hit/.test(trade.outcome);
  const isLoss = trade.outcome === "stopped_out";
  return (
    <Card className="p-4 border-border/60 bg-card/50 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div>
          <div className="font-medium tabular-nums">{trade.ticker}</div>
          <div className="text-xs text-muted-foreground font-mono">
            entry ${trade.user_entry_price.toFixed(2)}
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {trade.risk_profile}
        </Badge>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {trade.user_pnl_pct != null && (
          <span
            className={
              isWin
                ? "text-green-500 font-medium tabular-nums"
                : isLoss
                  ? "text-destructive font-medium tabular-nums"
                  : "text-muted-foreground tabular-nums"
            }
          >
            {trade.user_pnl_pct > 0 ? "+" : ""}
            {trade.user_pnl_pct.toFixed(2)}%
          </span>
        )}
        {trade.outcome && (
          <Badge variant={isWin ? "default" : isLoss ? "destructive" : "secondary"}>
            {trade.outcome.replace(/_/g, " ")}
          </Badge>
        )}
      </div>
    </Card>
  );
}
