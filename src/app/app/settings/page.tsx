import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  Activity,
  Bell,
  CalendarClock,
  Eye,
  Shield,
  Target,
  UserCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

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

  const sessionAlerts = (me.session_alerts ?? {}) as Record<string, boolean>;
  const enabledSessions = Object.entries(sessionAlerts)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const watchlist: string[] = Array.isArray(me.watchlist) ? me.watchlist : [];
  const alerts: string[] = Array.isArray(me.alerts) ? me.alerts : ["stocks"];

  return (
    <div className="space-y-10">
      <header>
        <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_oklch(0.7_0.14_230_/_0.6)]" />
          Preferences
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preferences that control which signals reach you. Editing
          inline lands in the next release — for now use the linked
          Telegram command on each row to change anything.
        </p>
      </header>

      {/* Top row: two side-by-side cards on desktop. Trading + Notifications
          balance well visually because each holds a small batch of rows.
          On mobile they stack as expected. */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <SettingsSection title="Trading" eyebrow="How EdgeNiq picks for you">
          <SettingRow
            icon={Shield}
            tone="emerald"
            label="Risk profile"
            command="/riskprofile"
            rightSlot={<ValuePill>{me.risk_profile ?? "—"}</ValuePill>}
          />
          <SettingRow
            icon={Target}
            tone="violet"
            label="Strategy"
            command="/strategy"
            rightSlot={<ValuePill>{me.strategy ?? "—"}</ValuePill>}
          />
          <SettingRow
            icon={Shield}
            tone="amber"
            label="Min share price"
            command="/setprice"
            description="Penny-stock policy. $5 = SEC threshold (default), $1 = low-priced US-listed names allowed, $0 = anything goes"
            rightSlot={
              <ValuePill>
                ${(typeof me.min_price === "number" ? me.min_price : 5).toFixed(2)}
              </ValuePill>
            }
          />
          <SettingRow
            icon={Eye}
            tone="sky"
            label="Watchlist"
            command="/watchlist"
            rightSlot={
              watchlist.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                  empty — add tickers via Telegram
                </span>
              ) : (
                <div className="flex flex-wrap justify-end gap-1.5 max-w-md">
                  {watchlist.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="font-mono text-[11px] py-0 h-5"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              )
            }
          />
        </SettingsSection>

        <SettingsSection
          title="Notifications"
          eyebrow="What reaches your phone"
        >
          <SettingRow
            icon={Bell}
            tone="amber"
            label="Alert types"
            command="/alerts"
            rightSlot={
              <div className="flex flex-wrap justify-end gap-1.5">
                {alerts.map((a) => (
                  <Badge
                    key={a}
                    className="bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[11px] py-0 h-5 capitalize"
                  >
                    {a}
                  </Badge>
                ))}
              </div>
            }
          />
          <SettingRow
            icon={CalendarClock}
            tone="rose"
            label="Session alerts"
            command="—"
            description="Pre-market, prime-time, EOD, and weekend recap notifications"
            rightSlot={
              enabledSessions.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                  none enabled
                </span>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[11px] py-0 h-5 text-muted-foreground"
                >
                  {enabledSessions.length} of{" "}
                  {Object.keys(sessionAlerts).length || enabledSessions.length}{" "}
                  enabled
                </Badge>
              )
            }
          />
          {enabledSessions.length > 0 && (
            <div className="mt-2 pl-12 flex flex-wrap gap-1.5">
              {enabledSessions.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="text-[10px] py-0 h-5 text-muted-foreground capitalize"
                >
                  {s.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}
        </SettingsSection>
      </div>

      {/* Account section — three-column row of identity stats so it reads
          like a banner across the full width instead of three stacked
          rows in a half-width card. */}
      <SettingsSection title="Account" eyebrow="Who you are on EdgeNiq">
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
          <AccountStat
            icon={UserCircle}
            tone="violet"
            label="Plan"
            value={
              <Badge className={planClass(me.sub_plan ?? "free")}>
                {me.sub_plan ?? "free"}
              </Badge>
            }
          />
          <AccountStat
            icon={Activity}
            tone="emerald"
            label="Status"
            value={
              <Badge className={statusClass(me.sub_status ?? "active")}>
                {me.sub_status ?? "active"}
              </Badge>
            }
          />
          <AccountStat
            icon={Shield}
            tone="sky"
            label="Role"
            value={<ValuePill>{me.role ?? "user"}</ValuePill>}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

function AccountStat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_CLASSES;
  label: string;
  value: React.ReactNode;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="px-5 py-5 flex items-center gap-4">
      <div
        className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 border ${t.bg} ${t.border}`}
      >
        <Icon className={`h-4 w-4 ${t.text}`} />
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div>{value}</div>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {eyebrow && (
          <span className="text-xs text-muted-foreground/70">{eyebrow}</span>
        )}
      </div>
      <Card className="p-2 border-border/60 bg-card/50 divide-y divide-border/40 overflow-hidden">
        {children}
      </Card>
    </section>
  );
}

const TONE_CLASSES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  emerald: {
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    text: "text-emerald-300",
  },
  violet: {
    bg: "bg-violet-400/10",
    border: "border-violet-400/30",
    text: "text-violet-300",
  },
  sky: {
    bg: "bg-sky-400/10",
    border: "border-sky-400/30",
    text: "text-sky-300",
  },
  amber: {
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    text: "text-amber-300",
  },
  rose: {
    bg: "bg-rose-400/10",
    border: "border-rose-400/30",
    text: "text-rose-300",
  },
};

function SettingRow({
  icon: Icon,
  tone = "emerald",
  label,
  command,
  description,
  rightSlot,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof TONE_CLASSES;
  label: string;
  command?: string;
  description?: string;
  rightSlot: React.ReactNode;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="px-4 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 border ${t.bg} ${t.border}`}
        >
          <Icon className={`h-4 w-4 ${t.text}`} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {description ? (
            <div className="text-xs text-muted-foreground mt-0.5">
              {description}
            </div>
          ) : command && command !== "—" ? (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Change via{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 font-mono text-[10px]">
                {command}
              </code>{" "}
              on Telegram
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-end">{rightSlot}</div>
    </div>
  );
}

function ValuePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted/40 border border-border/60 font-mono text-xs capitalize">
      {children}
    </span>
  );
}

function planClass(plan: string): string {
  switch (plan.toLowerCase()) {
    case "elite":
      return "bg-violet-400/15 text-violet-300 border border-violet-400/30 capitalize";
    case "pro":
      return "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 capitalize";
    default:
      return "bg-muted/40 text-muted-foreground border border-border/60 capitalize";
  }
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "trial") {
    return "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 capitalize";
  }
  if (s === "expired" || s === "suspended") {
    return "bg-rose-400/15 text-rose-300 border border-rose-400/30 capitalize";
  }
  return "bg-muted/40 text-muted-foreground border border-border/60 capitalize";
}
