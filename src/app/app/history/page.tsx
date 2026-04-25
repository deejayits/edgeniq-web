import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabaseAdmin } from "@/lib/supabase/server";

// Signal history — every resolved signal for this user. Each row has
// entry/exit/outcome. Sorted newest-first.
export default async function HistoryPage() {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!tgUserId) return null;

  const db = supabaseAdmin();
  const { data: records } = await db
    .from("signal_history")
    .select("*")
    .eq("user_chat_id", tgUserId)
    .order("closed_at", { ascending: false })
    .limit(200);

  const wins = (records ?? []).filter((r) => r.gain_pct > 0);
  const total = records?.length ?? 0;
  const winRate = total > 0 ? (wins.length / total) * 100 : 0;
  const avgGain =
    total > 0
      ? (records ?? []).reduce((s, r) => s + r.gain_pct, 0) / total
      : 0;

  return (
    <div className="space-y-10">
      <header>
        <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider">
          Activity
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every resolved signal, oldest at the bottom.
        </p>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <Card className="p-6 border-border/60 bg-card/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Total signals
          </div>
          <div className="text-3xl font-semibold tabular-nums">{total}</div>
        </Card>
        <Card className="p-6 border-border/60 bg-card/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Win rate
          </div>
          <div className="text-3xl font-semibold tabular-nums">
            {winRate.toFixed(1)}%
          </div>
        </Card>
        <Card className="p-6 border-border/60 bg-card/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Avg gain / signal
          </div>
          <div className="text-3xl font-semibold tabular-nums">
            {avgGain > 0 ? "+" : ""}
            {avgGain.toFixed(2)}%
          </div>
        </Card>
      </section>

      <section>
        {total === 0 ? (
          <Card className="p-8 border-border/60 bg-card/50 text-center">
            <p className="text-sm text-muted-foreground">
              No resolved signals yet. Come back once a few trades have
              completed.
            </p>
          </Card>
        ) : (
          <Card className="border-border/60 bg-card/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Gain</TableHead>
                  <TableHead className="text-right">Hold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(records ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.ticker}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {r.signal_type || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      ${r.entry_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      ${r.exit_price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.gain_pct > 0 ? "default" : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {r.exit_reason.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        r.gain_pct > 0
                          ? "text-green-500"
                          : "text-destructive"
                      }`}
                    >
                      {r.gain_pct > 0 ? "+" : ""}
                      {r.gain_pct.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">
                      {r.hold_time_mins < 60
                        ? `${r.hold_time_mins}m`
                        : `${Math.round(r.hold_time_mins / 60)}h`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
