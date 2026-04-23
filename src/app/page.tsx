import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, BarChart3, BellRing, ShieldCheck } from "lucide-react";

// Marketing landing page. Public; no auth required. Renders at /.
export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
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
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          Edge<span className="text-primary">Niq</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="#features"
            className="text-muted-foreground hover:text-foreground transition"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-muted-foreground hover:text-foreground transition"
          >
            How it works
          </Link>
          <Link
            href="#pricing"
            className="text-muted-foreground hover:text-foreground transition"
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
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-24">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Live signals on Telegram
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Your trading edge,{" "}
          <span className="text-muted-foreground">organized.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
          AI-scored stock signals delivered to Telegram the moment they
          fire. Per-user target ladders, personal trade tracking, and a
          web dashboard that actually tells you whether you&rsquo;re making
          money — without the guru noise.
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
    </section>
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
        <div>© {new Date().getFullYear()} EdgeNiq</div>
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
