import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandLockup, BrandMark } from "@/components/brand";
import { TelegramStartDialog } from "@/components/telegram-start-dialog";
import { PlanCheckoutButton } from "@/components/plan-checkout-button";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  Eye,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

// Telegram handoff now goes through <TelegramStartDialog /> which
// presents QR + app deep-link + Telegram Web fallback. Plain t.me URL
// is kept in that component's module scope.

// Marketing landing page. Public; no auth required. Renders at /.
// Session-aware: if the user is already logged in (cookie present from
// /app sign-in), show "Open dashboard" instead of "Log in" in the nav
// so new-tab visitors don't feel logged out.
export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      {/* Subtle grid + radial glow background. Pure CSS so no layout shift. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(110, 80, 255, 0.14), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(16, 185, 129, 0.1), transparent 60%)",
        }}
      />
      <SiteHeader isLoggedIn={isLoggedIn} />
      <main className="flex-1">
        <Hero />
        <StatsStrip />
        <Features />
        <WhyDifferent />
        <DashboardPreview />
        <HowItWorks />
        <Pricing />
        <FooterCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href="/" aria-label="EdgeNiq home">
          <BrandLockup iconSize={30} textClassName="text-lg" />
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="#features"
            className="hidden md:inline text-muted-foreground hover:text-foreground transition"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="hidden md:inline text-muted-foreground hover:text-foreground transition"
          >
            How it works
          </Link>
          <Link
            href="#pricing"
            className="hidden md:inline text-muted-foreground hover:text-foreground transition"
          >
            Pricing
          </Link>
          {isLoggedIn ? (
            <Button asChild size="sm">
              <Link href="/app">Open dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-12 pb-16 md:pt-20 md:pb-24">
      <div className="grid md:grid-cols-[1.1fr_1fr] gap-10 md:gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live signals on Telegram
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Trading signals,{" "}
            <span className="text-muted-foreground">with the math shown.</span>
          </h1>
          <p className="mt-5 md:mt-6 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
            Every signal ships with a 0–100 score, a letter grade, and
            the 5 components that produced it. Filtered through your
            risk profile, regime gate, and liquidity floor before it
            reaches you. No hype, no FOMO, no curated highlight reel —
            just the math, delivered to Telegram.
          </p>
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <TelegramStartDialog
              trigger={
                <Button size="lg">
                  <MessageSquare className="h-4 w-4" />
                  Start on Telegram
                </Button>
              }
            />
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Signup happens on Telegram — the bot onboards you in 30
            seconds, then the dashboard unlocks.
          </p>
        </div>
        <SignalMock />
      </div>
    </section>
  );
}

// Mock Telegram message rendering — captures the "what you get" feeling
// without shipping an image asset. Values are static; real feed uses
// live dashboard data.
function SignalMock() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-violet-500/10 blur-xl"
      />
      <Card className="relative p-5 border-border/70 bg-card/80 backdrop-blur-sm shadow-2xl">
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-violet-400 flex items-center justify-center text-[10px] font-bold text-background">
            EN
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">EdgeNiq Alerts</div>
            <div className="text-xs text-muted-foreground">just now</div>
          </div>
          <Badge variant="outline" className="text-xs">
            A+
          </Badge>
        </div>
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-semibold tabular-nums">NVDA</span>
              <span className="ml-2 text-sm text-muted-foreground font-mono">
                $195.40
              </span>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              ENTER
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Gap-up on 3.2× volume, above 50-SMA, RSI 62. Momentum
            breakout confirmed on daily.
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <TargetPill label="T1" pct="+2.0%" />
            <TargetPill label="T2" pct="+4.0%" />
            <TargetPill label="T3" pct="+6.0%" />
          </div>
          <div className="flex items-center justify-between text-xs font-mono border-t border-border/50 pt-3">
            <span className="text-muted-foreground">Stop</span>
            <span className="text-destructive">$187.58 (-4%)</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TargetPill({ label, pct }: { label: string; pct: string }) {
  return (
    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-emerald-400 font-mono">{pct}</div>
    </div>
  );
}

function StatsStrip() {
  const stats = [
    { label: "Scanners active", value: "10", hint: "24/7" },
    { label: "Sources", value: "3", hint: "Alpaca · Kalshi · Smart Money" },
    { label: "Signal horizon", value: "3–10d", hint: "Short to swing" },
    { label: "Data layer", value: "Postgres", hint: "Supabase" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-8 border-y border-border/40">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              {s.label}
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {s.value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{s.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 border-t border-border/40">
      <div className="mb-12">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          See every trade, not just the ones that worked.
        </h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          The dashboard shows your actual win rate by risk profile and
          setup type. The public backtest page exposes the same
          aggregate win rate per signal type — read it before signing
          up if you want the numbers without any of the marketing.
        </p>
      </div>
      <Card className="border-border/60 bg-card/50 overflow-hidden">
        <div className="border-b border-border/50 px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          </div>
          <div className="ml-1 text-xs font-mono text-muted-foreground">
            app.edgeniq.com/app
          </div>
          {/* Truth-in-advertising: this card shows the dashboard
              SHAPE, not real EdgeNiq performance. Public backtest
              page has actual win rates. */}
          <span className="ml-auto text-[10px] uppercase tracking-wider font-mono text-muted-foreground/70 px-2 py-0.5 rounded border border-border/40">
            Illustrative preview
          </span>
        </div>
        <div className="p-6 md:p-8">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <MockStatCard
              icon={TrendingUp}
              label="Win rate (30d)"
              value="64%"
              hint="Stock signals"
            />
            <MockStatCard
              icon={Target}
              label="Avg gain / signal"
              value="+2.1%"
              hint="After stops"
            />
            <MockStatCard
              icon={BarChart3}
              label="Open positions"
              value="4"
              hint="Active ladders"
            />
          </div>
          <div className="rounded-md border border-border/60 bg-background/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recently resolved
            </div>
            <div className="divide-y divide-border/40">
              {[
                { t: "META", setup: "momentum breakout", pct: 2.0, outcome: "T1 hit", win: true },
                { t: "TSLA", setup: "mean reversion", pct: -4.0, outcome: "stopped", win: false },
                { t: "SPY", setup: "trend continuation", pct: 4.1, outcome: "T2 hit", win: true },
                { t: "PLTR", setup: "volume spike", pct: 2.0, outcome: "T1 hit", win: true },
              ].map((r) => (
                <div
                  key={r.t}
                  className="px-4 py-3 flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium tabular-nums w-14">
                      {r.t}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.setup}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono"
                    >
                      {r.outcome}
                    </Badge>
                    <span
                      className={`font-mono tabular-nums ${
                        r.win ? "text-emerald-400" : "text-destructive"
                      }`}
                    >
                      {r.win ? "+" : ""}
                      {r.pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground text-center">
        Want the real aggregate numbers?{" "}
        <Link
          href="/app/backtest"
          className="text-primary hover:underline"
        >
          See live backtest by signal type →
        </Link>
      </p>
    </section>
  );
}

function MockStatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}

function Features() {
  const items = [
    {
      icon: BellRing,
      title: "Signals on Telegram",
      body: "Stocks, options, prediction markets — every alert ships with rationale, target ladder, stop-loss, and position size. Liquidity-filtered so thin tickers never reach you.",
    },
    {
      icon: Sparkles,
      title: "Conviction score per ticker",
      body: "Every name on your watchlist gets a 0–100 score that blends multiple market signals into one number. Top conviction surfaces on the dashboard so you know where to look first. Refreshed throughout the trading day.",
    },
    {
      icon: Zap,
      title: "Auto-trade via Alpaca",
      body: "Connect Alpaca paper. Bot places bracket orders on qualifying signals. When price hits T1 the stop auto-moves to breakeven — near-winners close at zero, not full loss.",
    },
    {
      icon: Eye,
      title: "Smart Money tracker",
      body: "Form 4 insider buys (~2-day SEC latency, fastest legal smart-money signal) plus 13F holdings from Buffett, Burry, Dalio, Ackman, Tepper, Icahn, Klarman. Cluster alerts when multiple insiders buy the same ticker. Telegram pings when a CFO buys a name on your watchlist.",
    },
    {
      icon: BarChart3,
      title: "Backtest dashboard",
      body: "Public hit rate and average gain per signal type, refreshed nightly. Same numbers we use to grade your personal history — no hidden methodology, no curated highlight reel.",
    },
    {
      icon: Target,
      title: "Personal target ladders",
      body: "YOUR entry, YOUR risk profile, YOUR exit targets — not the signal's canonical ladder. Directed target-hit and stop-hit alerts on your personal thresholds.",
    },
    {
      icon: ShieldCheck,
      title: "Regime-aware sizing",
      body: "VIX ≥ 25 or realized vol ≥ 1.5% / day automatically halves auto-trade position size. Extreme regimes quarter it. Confirmation lag + flicker detection prevent whipsaw.",
    },
    {
      icon: Settings,
      title: "Web + Telegram, your call",
      body: "Edit preferences inline on the web — risk profile, strategy, watchlist, penny-stock policy. Or use the Telegram commands. Same source of truth, propagates to the running bot within a minute.",
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid md:grid-cols-3 gap-6">
        {items.map((item) => (
          <Card key={item.title} className="p-6 border-border/60 bg-card/50">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-4">
              <item.icon className="h-4 w-4" />
            </div>
            <h3 className="font-medium mb-2">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.body}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Open the bot on Telegram",
      body: "Tap the link, hit /start, pick your risk profile and setup-type preference.",
    },
    {
      n: "02",
      title: "Signals fire throughout the day",
      body: "Pre-market, regular hours, post-market. You get the ones that match your profile.",
    },
    {
      n: "03",
      title: "Confirm your entry",
      body: "Tap 'I took this trade' — we track your personal targets from your actual entry price.",
    },
    {
      n: "04",
      title: "Review on the web",
      body: "Open the dashboard anytime for your open positions, history, and win rate by setup.",
    },
  ];
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-6xl px-6 py-20 border-t border-border/40"
    >
      <h2 className="text-3xl font-semibold tracking-tight mb-12">
        How it works
      </h2>
      <div className="grid md:grid-cols-4 gap-8">
        {steps.map((s) => (
          <div key={s.n}>
            <div className="text-xs font-mono text-muted-foreground mb-3">
              {s.n}
            </div>
            <h3 className="font-medium mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Why-we're-different section — positions EdgeNiq against the generic
// "trading alerts" / "buy signals" crowd. Keeps it honest: no claims
// of magical returns, just structural advantages.
function WhyDifferent() {
  const points = [
    {
      icon: Eye,
      title: "Math, not personalities",
      body: "Every signal ships with a 0–100 score, letter grade, and a plain-language rationale. You see why the bot fired, not just that it fired. Same conditions in, same signal out — no hot takes, no Discord drama.",
    },
    {
      icon: ShieldCheck,
      title: "Filtered before you see it",
      body: "Top most-active tickers run through multi-timeframe confirmation, volatility-regime gates, a $5M+ daily-dollar-volume liquidity floor, earnings filters, and your personal risk profile. Quality over quantity — most days produce a handful of signals or fewer.",
    },
    {
      icon: Zap,
      title: "Auditable & deterministic",
      body: "Same conditions produce the same signal, every time. /why explains the scanner's current state in real time. /history shows every closed trade — wins, stops, and expireds.",
    },
    {
      icon: BellRing,
      title: "Risk-profile aware",
      body: "Conservative users don't see $4 stocks gapping 12%. Aggressive users do. Your alerts reflect your account size and appetite — not a one-size-fits-all broadcast.",
    },
    {
      icon: Target,
      title: "Positions get tracked",
      body: "Confirm a signal and the bot watches it for you — alerts on T1/T2/T3 hits and stops, moves your stop to breakeven once T1 prints, fires an EOD flatten 15 min before close. Discipline, automated.",
    },
    {
      icon: Sparkles,
      title: "Smart Money, not gut money",
      body: "Form 4 insider buys (~2-day SEC latency) and 13F filings from Buffett, Burry, Dalio, Ackman, Tepper, Icahn, Klarman. Cluster alerts go louder when multiple insiders buy the same name. Disclosed positions, not pundits.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 border-t border-border/40">
      <div className="mb-12">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
          Why EdgeNiq
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Built for traders who want to see the work.
        </h2>
        <p className="text-sm md:text-base text-muted-foreground mt-3 leading-relaxed">
          Most signal services are entertainment dressed as edge —
          callers, hype, and a feed of curated wins. EdgeNiq shows
          you the math behind every alert, applies your risk
          profile, and tracks every position from entry to exit. No
          black box, no highlight reel.
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {points.map((p) => (
          <Card key={p.title} className="p-6 border-border/60 bg-card/50">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-400/15 to-violet-400/15 border border-border/60 flex items-center justify-center shrink-0">
                <p.icon className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <h3 className="font-medium mb-1.5">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {p.body}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

// Three-tier subscription pricing. Free is a 7-day trial with full
// Elite access so new users feel the ceiling before deciding. Pro is
// the focused "signals on my own stocks" tier. Elite unlocks
// whole-market discovery, options, prediction markets, and Smart Money.
function Pricing() {
  const tiers = [
    {
      name: "Trial",
      tag: "7 days · Elite features unlocked",
      price: "$0",
      priceSub: "for 7 days, no card",
      // Free tier CTA always goes to /login (Telegram signup flow) —
      // doesn't touch Stripe even when billing is live.
      cta: "Start free trial",
      ctaVariant: "outline" as const,
      ctaHref: "/login",
      stripePlan: null as "pro" | "elite" | null,
      highlights: [
        "All Elite features for 7 days — options, Smart Money, prediction markets, auto-trade",
        "Watchlist up to 25 tickers",
        "Stock signals limited to your watchlist (whole-market discovery is paid-Elite only)",
        "Web dashboard + Telegram bot",
        "Pick Pro or Elite when the trial ends — preferences carry over",
      ],
      featured: false,
      badge: null,
    },
    {
      name: "Pro",
      tag: "Stock signals for your list",
      price: "$49.99",
      priceSub: "/ mo",
      cta: "Join Pro",
      ctaVariant: "default" as const,
      ctaHref: "/login",
      stripePlan: "pro" as "pro" | "elite" | null,
      highlights: [
        "Stock signals — only for tickers on your watchlist",
        "Watchlist up to 25 tickers",
        "Conviction score (0–100) per watchlist ticker",
        "3 risk profiles (Conservative · Moderate · Aggressive) + 6 strategy templates",
        "Volatility-regime-aware sizing on every alert",
        "Live position monitor + portfolio advisor",
        "Edit preferences from web or Telegram — your call",
        "Backtest dashboard: hit rate by signal type",
        "Earnings calendar alerts (Yahoo Finance-backed)",
        "Full analytics: /history · /performance · /portfolio",
      ],
      featured: true,
      badge: "Most popular",
    },
    {
      name: "Elite",
      tag: "Everything the bot can do",
      price: "$99.99",
      priceSub: "/ mo",
      cta: "Go Elite",
      ctaVariant: "outline" as const,
      ctaHref: "/login",
      stripePlan: "elite" as "pro" | "elite" | null,
      highlights: [
        "Everything in Pro, plus:",
        "Watchlist up to 100 tickers + whole-market discovery beyond it",
        "Whole-market discovery — signals on any qualifying ticker, not just yours",
        "Liquidity-floor + relative-strength filtering",
        "Options alerts (unusual volume, block prints, OTM spikes)",
        "ETF directional calls — broad-market trend setups + sector rotation plays",
        "Prediction markets (Kalshi) with YES%/volume spike detection",
        "Smart Money — Form 4 insider buys + 13F filings (Buffett, Burry, Dalio, Ackman, Tepper, Icahn, Klarman)",
        "Insider cluster alerts — louder ping when multiple insiders buy the same name",
        "13F position classification — see what funds added, trimmed, or exited each quarter",
        "Telegram alerts when an insider buys a ticker on your watchlist",
        "Alpaca auto-trade (paper) — bracket orders with breakeven-at-T1 monitor, kill switch",
      ],
      featured: false,
      badge: null,
    },
  ];

  return (
    <section
      id="pricing"
      className="mx-auto max-w-6xl px-6 py-20 border-t border-border/40"
    >
      <div className="text-center mb-12">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
          Pricing
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Software pricing, not guru pricing.
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Most signal services charge several hundred dollars a month
          for personality-driven calls. EdgeNiq runs the math for you
          at a fraction of that. Start with a free 7-day Elite
          trial — no card required.
        </p>
        <div className="mt-6 mx-auto max-w-2xl rounded-md border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-xs text-amber-100/85 leading-relaxed">
          <span className="font-medium text-amber-200">
            Pro &amp; Elite checkout is not yet live.
          </span>{" "}
          The 7-day trial works today — start there. Contact the admin
          to activate Pro or Elite when your trial ends; self-serve
          billing lands in a future release.
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={`p-7 flex flex-col relative ${
              tier.featured
                ? "border-primary/40 bg-card/80 md:-my-2 md:py-9"
                : "border-border/60 bg-card/50"
            }`}
          >
            {tier.badge && (
              <span
                className={`absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full border ${
                  tier.featured
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/40 text-muted-foreground border-border/60"
                }`}
              >
                {tier.badge}
              </span>
            )}
            <h3 className="text-lg font-medium">{tier.name}</h3>
            <p className="text-xs text-muted-foreground mb-5">{tier.tag}</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-semibold tabular-nums">
                {tier.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {tier.priceSub}
              </span>
            </div>
            <ul className="space-y-2.5 text-sm mb-8 flex-1">
              {tier.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground leading-relaxed">
                    {h}
                  </span>
                </li>
              ))}
            </ul>
            {tier.stripePlan ? (
              <PlanCheckoutButton
                plan={tier.stripePlan}
                label={tier.cta}
                variant={tier.ctaVariant}
              />
            ) : (
              <Button asChild variant={tier.ctaVariant} className="w-full">
                <Link href={tier.ctaHref}>{tier.cta}</Link>
              </Button>
            )}
          </Card>
        ))}
      </div>

      <AddOnCard />

      <FeatureMatrix />
    </section>
  );
}

// Optional live-trading add-on for Elite subscribers. Pitched as the
// graduation step after 30-45 days of successful paper trading —
// message deliberately discourages skipping paper. Priced +$49.99/mo
// on top of Elite, for $149.98/mo total.
function AddOnCard() {
  return (
    <Card className="p-7 border-emerald-400/30 bg-gradient-to-br from-emerald-400/5 to-violet-400/5 mb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
              Add-on
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              requires Elite
            </Badge>
          </div>
          <h3 className="text-xl font-semibold tracking-tight">
            Live Trading
          </h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xl">
            Upgrade your Alpaca connection from paper to live. Real
            orders on real money. Opt in <b>only after 30-45 days of
            positive paper P&amp;L</b> — if the signals work for you
            in paper, they&rsquo;ll work in live. If they don&rsquo;t,
            you saved yourself the loss.
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground mt-4">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Unlocks <code>mode=live</code> on your Alpaca connection</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Enables Smart Money <b>mirror</b> mode (auto-shadow funds &amp; insiders)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Same risk rails + kill switch — every guardrail still applies</span>
            </li>
          </ul>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="text-right">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-3xl font-semibold tabular-nums">
                +$49.99
              </span>
              <span className="text-sm text-muted-foreground">/ mo</span>
            </div>
            <p className="text-xs text-muted-foreground">on top of Elite</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Start with paper first</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Full feature-by-tier comparison table. Scoped to the pricing page
// because the tier cards above necessarily elide detail. Free is
// rendered as "trial" — it's a 7-day look at Elite, not a permanent
// tier, so the comparison shows what users get during vs. after.
function FeatureMatrix() {
  const rows: Array<{
    label: string;
    free: string | boolean;
    pro: string | boolean;
    elite: string | boolean;
  }> = [
    // --- Signal discovery ---------------------------------------
    { label: "Stock signals", free: "Watchlist only", pro: "Watchlist only", elite: "Whole market (discovery)" },
    { label: "Watchlist size", free: "25 tickers", pro: "25 tickers", elite: "100 tickers" },
    { label: "Conviction score (0–100) per watchlist ticker", free: true, pro: true, elite: true },
    { label: "Relative strength vs SPY factor", free: true, pro: true, elite: true },
    { label: "Liquidity filter ($5M+ daily $-volume)", free: true, pro: true, elite: true },
    { label: "Penny-stock policy ($5 / $1 / $0 floor)", free: true, pro: true, elite: true },
    { label: "Grade + score + R/R gating", free: true, pro: true, elite: true },
    { label: "Options alerts (unusual vol · block · OTM)", free: true, pro: false, elite: true },
    { label: "ETF directional calls (broad market + sector rotation)", free: true, pro: false, elite: true },
    { label: "Prediction markets (Kalshi) with YES%/volume spike detection", free: true, pro: false, elite: true },
    // --- Smart Money ---------------------------------------------
    { label: "Smart Money — hedge fund 13F filings", free: true, pro: false, elite: true },
    { label: "Smart Money — 13F position classification (new · add · trim · exit)", free: true, pro: false, elite: true },
    { label: "Smart Money — Form 4 insider buys (~2d latency)", free: true, pro: false, elite: true },
    { label: "Smart Money — insider cluster alerts (multiple buyers, same name)", free: true, pro: false, elite: true },
    { label: "Smart Money — Telegram alerts on watchlist matches", free: true, pro: false, elite: true },
    { label: "Smart Money mirror (auto-shadow trades)", free: false, pro: false, elite: "Add-on +$49.99/mo" },
    // --- Execution -----------------------------------------------
    { label: "Alpaca auto-trade (paper mode)", free: true, pro: false, elite: true },
    { label: "Alpaca auto-trade (live mode)", free: false, pro: false, elite: "Add-on +$49.99/mo" },
    { label: "Breakeven-at-T1 stop monitor", free: true, pro: false, elite: true },
    { label: "Volatility-regime sizing (auto halves in elevated)", free: true, pro: true, elite: true },
    { label: "Kill switch + risk rails", free: true, pro: false, elite: true },
    // --- Personalization -----------------------------------------
    { label: "Risk profiles (Conservative · Moderate · Aggressive)", free: "All 3", pro: "All 3", elite: "All 3" },
    { label: "Strategy templates (momentum, mean-reversion, +4 more)", free: "All 6", pro: "All 6", elite: "All 6" },
    { label: "Per-user target ladders (YOUR entry, YOUR targets)", free: true, pro: true, elite: true },
    // --- Analytics + dashboards ----------------------------------
    { label: "Live position monitor", free: true, pro: true, elite: true },
    { label: "Portfolio advisor (concentration · theme · streak)", free: true, pro: true, elite: true },
    { label: "Full trade history + win-rate analytics", free: true, pro: true, elite: true },
    { label: "Backtest dashboard — public hit rate per signal type", free: true, pro: true, elite: true },
    { label: "Earnings calendar alerts", free: true, pro: "For watchlist", elite: "Whole market" },
    { label: "Session briefings (pre-market · EOD)", free: true, pro: true, elite: true },
    { label: "Glossary reference (/glossary)", free: true, pro: true, elite: true },
    // --- Web + Telegram parity -----------------------------------
    { label: "Edit risk profile / strategy / watchlist on web", free: true, pro: true, elite: true },
    { label: "Telegram bot for every command", free: true, pro: true, elite: true },
    // --- Trial ---------------------------------------------------
    { label: "Trial length", free: "7 days", pro: "—", elite: "—" },
  ];

  return (
    <div>
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4 text-center">
        Full feature comparison
      </div>
      <Card className="border-border/60 bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                  Feature
                </th>
                <th className="text-center px-4 py-3 font-medium">Trial</th>
                <th className="text-center px-4 py-3 font-medium text-primary">
                  Pro
                </th>
                <th className="text-center px-4 py-3 font-medium">Elite</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="px-5 py-3 text-muted-foreground">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MatrixCell v={row.free} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MatrixCell v={row.pro} featured />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MatrixCell v={row.elite} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground text-center mt-4 max-w-2xl mx-auto">
        Free is a 7-day trial with full Elite access. After the trial
        ends, choose Pro or Elite to keep receiving signals.
      </p>
    </div>
  );
}

function MatrixCell({
  v,
  featured,
}: {
  v: string | boolean;
  featured?: boolean;
}) {
  if (v === true) {
    return (
      <Check
        className={`inline h-4 w-4 ${
          featured ? "text-primary" : "text-emerald-400"
        }`}
      />
    );
  }
  if (v === false) {
    return <span className="text-muted-foreground/40">—</span>;
  }
  return (
    <span
      className={`text-xs ${featured ? "text-foreground" : "text-muted-foreground"}`}
    >
      {v}
    </span>
  );
}

function FooterCTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center border-t border-border/40">
      <h2 className="text-4xl font-semibold tracking-tight mb-4">
        Ready to trade with a system?
      </h2>
      <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
        Tap the button, the bot walks you through onboarding in under
        a minute, then come back here to see your dashboard.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <TelegramStartDialog
          trigger={
            <Button size="lg">
              <MessageSquare className="h-4 w-4" />
              Start on Telegram <ArrowRight className="h-4 w-4" />
            </Button>
          }
        />
        <Button asChild variant="ghost" size="lg">
          <Link href="/login">I already have an account</Link>
        </Button>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/40 py-8 text-sm text-muted-foreground">
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          © {new Date().getFullYear()} <BrandMark className="text-[13px]" />
        </div>
        <div className="flex gap-6">
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
