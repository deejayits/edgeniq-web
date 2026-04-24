import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandLockup, BrandMark } from "@/components/brand";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";

// Marketing landing page. Public; no auth required. Renders at /.
export default function LandingPage() {
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
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <StatsStrip />
        <Features />
        <DashboardPreview />
        <HowItWorks />
        <Pricing />
        <FooterCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
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
          <Button asChild size="sm" variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
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
            Your trading edge,{" "}
            <span className="text-muted-foreground">organized.</span>
          </h1>
          <p className="mt-5 md:mt-6 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
            AI-scored stock signals delivered to Telegram the moment they
            fire. Per-user target ladders, personal trade tracking, and a
            web dashboard that actually tells you whether you&rsquo;re
            making money — without the guru noise.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="#how-it-works">How it works</Link>
            </Button>
          </div>
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
    { label: "Sources", value: "4", hint: "Alpaca · Kalshi · Polymarket · Whales" },
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
      <div className="max-w-2xl mb-12">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          See every trade, not just the ones that worked.
        </h2>
        <p className="mt-4 text-muted-foreground">
          The dashboard shows your actual win rate by risk profile and
          setup type — no cherry-picking, no screenshots that conveniently
          omit the losers.
        </p>
      </div>
      <Card className="border-border/60 bg-card/50 overflow-hidden">
        <div className="border-b border-border/50 px-6 py-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          </div>
          <div className="ml-3 text-xs font-mono text-muted-foreground">
            app.edgeniq.com/app
          </div>
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
      body: "Gap-ups, momentum breakouts, reversion bounces — every signal comes with a plain-English rationale, target ladder, and stop-loss. No daily noise bombs.",
    },
    {
      icon: BarChart3,
      title: "Dashboard that earns its keep",
      body: "See today's activity, your open positions, historical win rate by setup type, and portfolio concentration warnings in one place.",
    },
    {
      icon: ShieldCheck,
      title: "Built for real money",
      body: "No paper-trading boasts. Every signal is logged, every outcome tracked. You see the 30-day win rate for your risk profile, not a curated highlight reel.",
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

function Pricing() {
  return (
    <section
      id="pricing"
      className="mx-auto max-w-6xl px-6 py-20 border-t border-border/40"
    >
      <div className="text-center mb-12">
        <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
        <p className="mt-3 text-muted-foreground">
          Open beta. Invite-only today — pricing launches when the queue
          opens.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="p-8 border-border/60 bg-card/50">
          <h3 className="text-lg font-medium mb-1">Free</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Beta-tester slot
          </p>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>5 signals / day</li>
            <li>Core risk profiles</li>
            <li>Web dashboard access</li>
          </ul>
        </Card>
        <Card className="p-8 border-primary/40 bg-card/50 relative">
          <span className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            Coming soon
          </span>
          <h3 className="text-lg font-medium mb-1">Pro</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Unlimited signals + advanced features
          </p>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>Unlimited signals</li>
            <li>Strategy templates</li>
            <li>Portfolio advisor</li>
            <li>Custom risk profile</li>
            <li>Earnings calendar alerts</li>
          </ul>
        </Card>
      </div>
    </section>
  );
}

function FooterCTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center border-t border-border/40">
      <h2 className="text-4xl font-semibold tracking-tight mb-4">
        Ready to trade with a system?
      </h2>
      <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
        Log in with Telegram to access the dashboard. If you&rsquo;re not
        in the beta yet, request access from the admin.
      </p>
      <Button asChild size="lg">
        <Link href="/login">
          Log in with Telegram <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
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
