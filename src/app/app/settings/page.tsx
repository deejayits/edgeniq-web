import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeaderStat } from "@/components/header-stat";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  Bell,
  BellRing,
  CalendarClock,
  Eye,
  Shield,
  Target,
} from "lucide-react";
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import {
  RiskProfileEditor,
  StrategyEditor,
  MinPriceEditor,
  WatchlistEditor,
} from "./editors";
import { watchlistCapFromRow } from "@/lib/watchlist-caps";

export const dynamic = "force-dynamic";

// Settings — Trading section is web-editable now (risk profile,
// strategy, min share price, watchlist) via server actions that write
// directly to Supabase. The bot's _user_sync_loop polls the same row
// every 60s, so changes propagate to the running scanner within a
// minute. Notifications + Account are still read-only — alert types
// and session alerts have notification side effects we don't want to
// fan-out from the web (yet).
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

  // Pull conviction snapshots for every watchlist ticker. The bot's
  // conviction writer keeps this table fresh; if a ticker has no row
  // yet (just added, writer hasn't ticked) the badge renders "—"
  // rather than blocking the page. Plain object passed to the client
  // editor — Maps don't serialize across the server/client boundary.
  const convictionByTicker: Record<string, number> = {};
  if (watchlist.length > 0) {
    const { data: convRows } = await db
      .from("conviction_scores")
      .select("ticker, score")
      .in("ticker", watchlist.map((t) => t.toUpperCase()));
    for (const row of convRows ?? []) {
      if (row?.ticker && typeof row.score === "number") {
        convictionByTicker[row.ticker.toUpperCase()] = row.score;
      }
    }
  }

  const planLabel = (me.sub_plan ?? "free").toString();
  const statusLabel = (me.sub_status ?? "active").toString();
  const statusTone: "emerald" | "amber" | "rose" | "muted" =
    statusLabel === "active" || statusLabel === "trial"
      ? "emerald"
      : statusLabel === "expired" || statusLabel === "suspended"
        ? "rose"
        : "muted";

  // User's actual watchlist cap for the right-rail tile. Sourced
  // from the same per-tier helper the addWatchlistTicker action
  // uses, so the displayed "X of Y max" matches what the server
  // would let them add.
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const watchlistCap = watchlistCapFromRow({
    role: userRole,
    subPlan: planLabel,
    subStatus: statusLabel,
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_oklch(0.7_0.14_230_/_0.6)]" />
            Preferences
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            Preferences that control which signals reach you. Trading
            changes save instantly and reach the running bot within a
            minute. Notifications still use the Telegram command on each
            row.
          </p>
        </div>
        <div className="flex items-stretch gap-3">
          <HeaderStat
            label="Plan"
            value={planLabel}
            sub={
              planLabel === "elite"
                ? "all features"
                : planLabel === "pro"
                  ? "stocks + watchlist"
                  : "limited"
            }
            tone={
              planLabel === "elite"
                ? "primary"
                : planLabel === "pro"
                  ? "emerald"
                  : "muted"
            }
            className="capitalize"
          />
          <HeaderStat
            label="Status"
            value={statusLabel}
            sub={statusLabel === "trial" ? "free for 7d" : "subscription"}
            tone={statusTone}
            className="capitalize"
          />
          <HeaderStat
            label="Watchlist"
            value={`${watchlist.length}`}
            sub={`of ${watchlistCap} max`}
            tone="muted"
          />
        </div>
      </header>

      {/* Trading prefs — three vertical cards in a 3-up grid. Earlier
          revisions tried to put the editor on the right of the label
          via SettingRow, but the per-option help text wraps to multiple
          lines and there isn't horizontal room for both label + 20rem
          editor + 20rem help in a 1/3-width cell. Stacking vertically
          (label/eyebrow on top, editor + per-option help underneath)
          uses the cell's full width and keeps everything readable. */}
      <SettingsSection title="Trading" eyebrow="How EdgeNiq picks for you">
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40">
          <TradingPrefCell
            icon={Shield}
            tone="emerald"
            label="Risk profile"
            eyebrow="Sizing + selectivity"
          >
            <RiskProfileEditor value={me.risk_profile ?? "moderate"} />
          </TradingPrefCell>
          <TradingPrefCell
            icon={Target}
            tone="violet"
            label="Strategy"
            eyebrow="Setup-type filter"
          >
            <StrategyEditor value={me.strategy ?? "balanced"} />
          </TradingPrefCell>
          <TradingPrefCell
            icon={Shield}
            tone="amber"
            label="Min share price"
            eyebrow="Penny-stock policy"
          >
            <MinPriceEditor
              value={typeof me.min_price === "number" ? me.min_price : 5}
            />
          </TradingPrefCell>
        </div>
      </SettingsSection>

      {/* Watchlist — full width. Each conviction-scored chip is wider
          than a normal badge (ticker + score + delete X) so users with
          20-50 tickers get the row real estate to scan them quickly. */}
      <SettingsSection
        title="Watchlist"
        eyebrow="Tickers you track"
      >
        <div className="px-5 py-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <b className="text-foreground">Conviction score</b> (the
            badge next to each ticker) blends trend, 52-week position,
            sector strength, insider activity, and volatility regime —
            a 0&ndash;100 ranking refreshed every 15 min to prioritize
            your list. <b className="text-foreground">Alerts fire in
            real time</b> as setups appear; they don&rsquo;t wait on
            the next conviction tick.
          </p>
          <WatchlistEditor
            initial={watchlist.map((t) => t.toUpperCase())}
            scoreByTicker={convictionByTicker}
          />
        </div>
      </SettingsSection>

      {/* Notifications — full width with rows that don't crush the
          description text. Alert types + Browser alerts side-by-side
          on desktop since both are short toggles; Session alerts is
          its own row because the chip list expands wide. */}
      <SettingsSection
        title="Notifications"
        eyebrow="What reaches your phone"
      >
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/40">
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
            icon={BellRing}
            tone="primary"
            label="Browser alerts"
            description="Push notifications on this device when signals fire — same payload as Telegram. Opt-in, per device."
            rightSlot={<PushSubscribeButton />}
          />
        </div>
        <SettingRow
          icon={CalendarClock}
          tone="rose"
          label="Session alerts"
          command="—"
          description="Pre-market, prime-time, EOD, and weekend recap"
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
          <div className="px-5 pb-4 flex flex-wrap gap-1.5">
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

      {/* Plan + Status are already in the header HeaderStat tiles.
          Role for non-admins is always "user" (no signal); for admins,
          the "EdgeNiqAdmin" username in the top-right user menu
          already conveys it. So the bottom Account section is gone —
          everything it surfaced is already visible above. */}
    </div>
  );
}

function SettingsSection({
  title,
  eyebrow,
  className,
  children,
}: {
  title: string;
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {eyebrow && (
          <span className="text-xs text-muted-foreground/70">{eyebrow}</span>
        )}
      </div>
      <Card className="p-0 border-border/60 bg-card/50 divide-y divide-border/40 overflow-hidden">
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
  primary: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    text: "text-primary",
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
  stackOnMobile,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof TONE_CLASSES;
  label: string;
  command?: string;
  description?: string;
  rightSlot: React.ReactNode;
  /** Stack the right slot below the label on narrower screens. Use
      for wide editors like the watchlist where putting them on the
      right would crush either the label or the editor. */
  stackOnMobile?: boolean;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div
      className={`px-5 py-5 flex flex-wrap gap-x-6 gap-y-4 ${stackOnMobile ? "flex-col md:flex-row md:items-start md:justify-between" : "items-center justify-between"}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 border ${t.bg} ${t.border}`}
        >
          <Icon className={`h-4 w-4 ${t.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
          {description ? (
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
              {description}
            </div>
          ) : command && command !== "—" ? (
            <div className="text-[11px] text-muted-foreground mt-1">
              Change via{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 font-mono text-[10px]">
                {command}
              </code>{" "}
              on Telegram
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={`flex items-center ${stackOnMobile ? "w-full md:w-auto md:justify-end" : "justify-end"}`}
      >
        {rightSlot}
      </div>
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

// Vertical cell for the Trading 3-up grid. Stacks label+eyebrow on
// top of the editor so per-option help text below the editor has the
// full cell width to wrap into. Used instead of SettingRow because
// SettingRow's left/right split doesn't work in narrow cells.
function TradingPrefCell({
  icon: Icon,
  tone,
  label,
  eyebrow,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_CLASSES;
  label: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="px-5 py-5 space-y-4">
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 border ${t.bg} ${t.border}`}
        >
          <Icon className={`h-4 w-4 ${t.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            {eyebrow}
          </div>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

