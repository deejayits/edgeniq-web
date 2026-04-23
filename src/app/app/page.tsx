import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Activity, Flame, LineChart, Target } from "lucide-react";

// Dashboard home — "Today" view. Shows:
//   * a greeting + the user's risk profile / strategy
//   * today's activity summary (signals delivered / resolved)
//   * open positions count
//   * quick-link cards to the deeper views
//
// All data comes from Supabase (server-role key). RLS is defense-in-depth;
// primary authZ is us filtering by session.user.tgUserId.
export default async function AppHome() {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!tgUserId) return null; // layout redirected; belt + suspenders

  const db = supabaseAdmin();

  const [{ data: me }, { count: openTradeCount }, { count: todaySignalCount }] =
    await Promise.all([
      db
        .from("users")
        .select("username, risk_profile, strategy, sub_plan, watchlist")
        .eq("chat_id", tgUserId)
        .single(),
      db
        .from("personal_trades")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", tgUserId)
        .eq("status", "active"),
      db
        .from("signal_history")
        .select("*", { count: "exact", head: true })
        .eq("user_chat_id", tgUserId)
        .gte("closed_at", new Date(Date.now() - 86_400_000).toISOString()),
    ]);

  return (
    <div className="space-y-8">
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
            Risk: {me?.risk_profile ?? "moderate"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Strategy: {me?.strategy ?? "balanced"}
          </Badge>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <StatCard
          icon={Flame}
          label="Signals resolved (24h)"
          value={todaySignalCount ?? 0}
          hint="Closed with outcome"
        />
        <StatCard
          icon={Target}
          label="Open positions"
          value={openTradeCount ?? 0}
          hint="Confirmed personal trades"
        />
        <StatCard
          icon={Activity}
          label="Watchlist"
          value={me?.watchlist?.length ?? 0}
          hint="Tickers you track"
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Next up
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-border/60 bg-card/50">
            <div className="flex items-start gap-3">
              <LineChart className="h-4 w-4 mt-1 text-primary" />
              <div>
                <h3 className="font-medium mb-1">
                  Performance by setup type
                </h3>
                <p className="text-sm text-muted-foreground">
                  Win rate, avg gain, hold time — broken down by strategy
                  template. Coming in the next release.
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-border/60 bg-card/50">
            <div className="flex items-start gap-3">
              <Target className="h-4 w-4 mt-1 text-primary" />
              <div>
                <h3 className="font-medium mb-1">Position monitor</h3>
                <p className="text-sm text-muted-foreground">
                  Live view of active trades with target ladders. Matches
                  what the bot sees in real time.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <Card className="p-6 border-border/60 bg-card/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </Card>
  );
}
