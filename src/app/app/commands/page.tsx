import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Command = {
  cmd: string;
  desc: string;
  example?: string;
  tier?: "elite" | "pro" | "any" | "admin" | "primary";
};

// Section groupings mirror the bot's /help command so users see the
// same mental model on both surfaces. Tier badges call out which
// commands require Elite (vs. usable on any plan).
const GENERAL: Command[] = [
  { cmd: "/status", desc: "scanner health + current session" },
  { cmd: "/session", desc: "market session details + today's schedule" },
  { cmd: "/about", desc: "what EdgeNiq is" },
  { cmd: "/top", desc: "top markets right now" },
  { cmd: "/signals", desc: "top live signals (personalized)" },
  { cmd: "/mystats", desc: "your account info" },
  { cmd: "/pause", desc: "mute alerts for 1 hour" },
  { cmd: "/resume", desc: "unmute" },
];

const RESEARCH: Command[] = [
  {
    cmd: "/ticker SYMBOL",
    desc: "deep analysis for any stock",
    example: "/ticker NVDA",
  },
  {
    cmd: "/market TOPIC",
    desc: "find prediction markets",
    example: "/market bitcoin",
  },
  {
    cmd: "/congress",
    desc: "browse Smart Money — politicians + hedge funds + insiders",
    tier: "elite",
  },
  {
    cmd: "/congress <name>",
    desc: "one target's recent trades + follow/unfollow inline",
    example: "/congress pelosi",
    tier: "elite",
  },
  { cmd: "/marketstatus", desc: "current market conditions" },
  { cmd: "/today", desc: "all signals fired today + live status" },
  { cmd: "/eod", desc: "today's end-of-day summary (on demand)" },
  { cmd: "/portfolio", desc: "open positions, concentration warnings" },
  {
    cmd: "/mymarkets",
    desc: "your open prediction-market positions (what you took)",
    tier: "elite",
  },
  {
    cmd: "/myoptions",
    desc: "your open options positions (what you entered)",
    tier: "elite",
  },
  { cmd: "/history", desc: "your complete trade history" },
  { cmd: "/performance", desc: "win-rate, realized P&L, streak stats" },
  {
    cmd: "/alert TICKER above|below PRICE",
    desc: "one-shot price alert",
    example: "/alert TSLA above 250",
  },
  { cmd: "/alerts", desc: "list your active price alerts" },
  { cmd: "/earnings [TICKER]", desc: "upcoming earnings calendar" },
  { cmd: "/tradedetail ID", desc: "full breakdown of one trade" },
  { cmd: "/cancel", desc: "cancel a pending multi-step flow" },
  {
    cmd: "/connect",
    desc: "link your Alpaca account for auto-trading",
    tier: "elite",
  },
  {
    cmd: "/autotrade [on|off]",
    desc: "auto-trade status / quick toggle across signal types",
    tier: "elite",
  },
  {
    cmd: "/kill YES",
    desc: "emergency stop: cancel all open orders + disable auto-trade",
    tier: "elite",
  },
];

const PERSONALIZE: Command[] = [
  { cmd: "/preferences", desc: "view all your settings" },
  { cmd: "/quicksetup", desc: "guided 60-second setup" },
  { cmd: "/setalerts", desc: "choose markets to watch" },
  { cmd: "/setrisk", desc: "set profit targets + stop loss" },
  { cmd: "/setposition", desc: "set position size %" },
  { cmd: "/setminscore", desc: "set minimum signal score" },
  {
    cmd: "/strategy",
    desc: "pick setup-type filter (momentum, reversion, etc.)",
  },
  { cmd: "/strategies", desc: "describe all strategies" },
  { cmd: "/watchlist", desc: "manage your ticker watchlist" },
  { cmd: "/myalerts", desc: "your personalized alert history" },
];

const PRIVACY: Command[] = [
  { cmd: "/privacy", desc: "full privacy policy" },
  { cmd: "/mydata", desc: "see all data we hold on you" },
  { cmd: "/exportmydata", desc: "download your data as a file" },
  { cmd: "/deleteaccount", desc: "delete your account (two-step)" },
];

const ADMIN: Command[] = [
  { cmd: "/users", desc: "list all users" },
  { cmd: "/adduser <id> <username>", desc: "add user" },
  { cmd: "/removeuser <username>", desc: "revoke access" },
  { cmd: "/suspenduser <username>", desc: "suspend" },
  { cmd: "/restoreuser <username>", desc: "restore" },
  { cmd: "/userinfo <username>", desc: "detail" },
  { cmd: "/broadcast <msg>", desc: "announce to everyone" },
  { cmd: "/invite", desc: "one-shot invite token" },
  { cmd: "/extend <username> <days>", desc: "extend trial" },
  { cmd: "/setplan <username> <free|pro|elite>", desc: "change tier" },
  { cmd: "/blacklist [TICKER]", desc: "show or add bad-exit blocks" },
  { cmd: "/unblacklist TICKER", desc: "remove a blacklist entry" },
  { cmd: "/accuracy", desc: "signal-accuracy report" },
  { cmd: "/tickerstats TICKER", desc: "per-ticker win rate" },
  { cmd: "/userwatchlist <username>", desc: "see their watchlist" },
  { cmd: "/privacyrequests", desc: "pending GDPR requests" },
  { cmd: "/gdprexport <username>", desc: "export user's data" },
  { cmd: "/maintenance", desc: "put bot in maintenance mode" },
  { cmd: "/unlock", desc: "exit maintenance/lockdown" },
  { cmd: "/health", desc: "resource gauges + activity" },
];

const PRIMARY_ONLY: Command[] = [
  { cmd: "/admins", desc: "list all admins" },
  {
    cmd: "/addadmin <id> <username> [primary|secondary]",
    desc: "promote",
  },
  { cmd: "/removeadmin <username>", desc: "demote to user" },
  { cmd: "/purgeuser <username>", desc: "hard delete (irreversible)" },
  { cmd: "/lockdown", desc: "pause all non-admin traffic" },
];

function TierBadge({ tier }: { tier?: Command["tier"] }) {
  if (!tier || tier === "any") return null;
  const label =
    tier === "elite" ? "Elite" : tier === "pro" ? "Pro" : null;
  if (!label) return null;
  const cls =
    tier === "elite"
      ? "bg-violet-400/15 text-violet-300 border-violet-400/30"
      : "bg-primary/15 text-primary border-primary/30";
  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  );
}

function Section({
  title,
  items,
  description,
}: {
  title: string;
  items: Command[];
  description?: string;
}) {
  return (
    <Card className="p-6 border-border/60 bg-card/40">
      <h2 className="font-medium mb-1">{title}</h2>
      {description && (
        <p className="text-xs text-muted-foreground mb-4">{description}</p>
      )}
      <div className="space-y-3">
        {items.map((c) => (
          <div
            key={c.cmd}
            className="flex items-start gap-4 text-sm font-mono"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-foreground font-semibold">{c.cmd}</code>
                <TierBadge tier={c.tier} />
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                {c.desc}
              </p>
              {c.example && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-sans italic">Example: </span>
                  <code>{c.example}</code>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function CommandsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/app/commands");
  const role =
    (session.user as { role?: string } | undefined)?.role ?? "user";
  const isAdmin = role === "admin" || role === "primary_admin";
  const isPrimary = role === "primary_admin";

  return (
    <div className="space-y-10">
      <header>
        <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_oklch(0.7_0.18_15_/_0.6)]" />
          Reference
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Bot commands
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
          The EdgeNiq bot lives on Telegram. Every feature — watchlist
          edits, risk profile changes, price alerts, strategy switches —
          is a command. This page mirrors <code>/help</code> inside the
          bot, grouped by what you actually need.
        </p>
      </header>

      {/* Quick-jump to Telegram */}
      <Card className="p-5 border-border/60 bg-gradient-to-br from-emerald-400/5 to-violet-400/5">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-md bg-card/80 border border-border/60 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm">Open the bot</h3>
            <p className="text-xs text-muted-foreground">
              Copy any command and paste it into your bot chat.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a
              href="https://t.me/edgeniq_alerts_bot"
              target="_blank"
              rel="noreferrer"
            >
              Open @edgeniq_alerts_bot
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </Card>

      <Section
        title="General"
        items={GENERAL}
        description="Daily-use commands — status, pause/resume, your top signals."
      />
      <Section
        title="Research &amp; trade"
        items={RESEARCH}
        description="Look up tickers, markets, or your own performance. Some commands (marked Elite) are only available on the paid Elite tier."
      />
      <Section
        title="Personalizing your alerts"
        items={PERSONALIZE}
        description="Tell the bot what kinds of signals you want, what risk you can tolerate, and which tickers you care about most."
      />
      <Section
        title="Privacy &amp; data"
        items={PRIVACY}
        description="Everything EdgeNiq knows about you is retrievable and deletable."
      />

      {isAdmin && (
        <Section
          title="Admin"
          items={ADMIN}
          description="User management, broadcasts, blacklists, GDPR tools."
        />
      )}
      {isPrimary && (
        <Section
          title="Primary admin only"
          items={PRIMARY_ONLY}
          description="Destructive + compliance commands reserved for the primary admin."
        />
      )}
    </div>
  );
}
