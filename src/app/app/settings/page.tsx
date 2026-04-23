import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabaseAdmin } from "@/lib/supabase/server";

// Settings — read-only for now. Edit flows (change strategy, risk
// profile, watchlist) will land in follow-up PRs with server actions
// that mirror into Supabase and trip the bot's dual-write mirror too.
export default async function SettingsPage() {
  const session = await auth();
  const tgUserId = (session?.user as { tgUserId?: number } | undefined)
    ?.tgUserId;
  if (!tgUserId) return null;

  const db = supabaseAdmin();
  const { data: me } = await db
    .from("users")
    .select("*")
    .eq("chat_id", tgUserId)
    .single();
  if (!me) return null;

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preferences that control which signals reach you. Editing is
          coming in the next release — for now, use the Telegram bot
          commands to change these.
        </p>
      </header>

      <Card className="p-6 border-border/60 bg-card/50 space-y-4">
        <SettingRow
          label="Risk profile"
          value={me.risk_profile}
          hint="Change via /riskprofile on Telegram"
        />
        <Separator />
        <SettingRow
          label="Strategy template"
          value={me.strategy}
          hint="Change via /strategy on Telegram"
        />
        <Separator />
        <SettingRow
          label="Watchlist"
          value={
            me.watchlist?.length ? me.watchlist.join(", ") : "— empty —"
          }
          hint="Change via /watchlist on Telegram"
        />
        <Separator />
        <SettingRow
          label="Alert types"
          value={me.alerts?.join(", ") || "stocks"}
          hint="Toggle via /alerts on Telegram"
        />
        <Separator />
        <SettingRow
          label="Session alerts"
          value={formatSessionAlerts(me.session_alerts)}
          hint="Control which market-session notifications fire"
        />
      </Card>

      <Card className="p-6 border-border/60 bg-card/50 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Account
        </h2>
        <div className="text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Plan</span>
            <Badge variant="outline">{me.sub_plan}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline">{me.sub_status}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="outline">{me.role}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SettingRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && (
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        )}
      </div>
      <div className="text-sm text-right font-mono max-w-[60%]">{value}</div>
    </div>
  );
}

function formatSessionAlerts(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "default";
  const on = Object.entries(raw as Record<string, boolean>)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (on.length === 0) return "none";
  return on.join(", ");
}
