import Link from "next/link";

export const metadata = {
  title: "Terms of Service — EdgeNiq",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-sm">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block"
      >
        ← Back
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Placeholder — the authoritative terms are delivered in the bot
        on first /start. This page will mirror the same content once
        rendering is wired up.
      </p>
      <div className="text-sm leading-relaxed space-y-4">
        <p>
          EdgeNiq provides algorithmically-derived stock signals for
          informational purposes only. Signals are not investment
          advice, and the service is not a broker-dealer or investment
          advisor. You are solely responsible for your trading
          decisions and any resulting gains or losses.
        </p>
        <p>
          Past performance does not guarantee future results. Signals
          can and do fail — review the outcomes on your dashboard, not
          the marketing.
        </p>
        <p>
          By using EdgeNiq you agree not to redistribute signals,
          reverse-engineer the scoring system, or use the service for
          any purpose prohibited by US securities law.
        </p>
      </div>
    </div>
  );
}
