import Link from "next/link";

export const metadata = {
  title: "Terms of Service — EdgeNiq",
};

const LAST_UPDATED = "2026-04-24";

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
        Last updated: {LAST_UPDATED}
      </p>

      <div className="text-sm leading-relaxed space-y-5">
        <Section title="What EdgeNiq is">
          <p>
            EdgeNiq provides algorithmically-derived trading signals
            (stocks, options, prediction markets, and smart-money
            tracking) delivered via Telegram bot and a
            companion web dashboard. Signals are{" "}
            <b>informational only</b>. EdgeNiq is not a broker-dealer,
            investment advisor, or fiduciary, and nothing we send
            constitutes a recommendation, solicitation, or endorsement
            to buy or sell any security or contract.
          </p>
        </Section>

        <Section title="Your responsibility">
          <p>
            You are solely responsible for every trading decision you
            make and every order executed on your behalf, <b>including
            orders submitted by the auto-trading feature</b>. You
            understand:
          </p>
          <ul>
            <li>Signals can and do fail. Past performance is not indicative of future results.</li>
            <li>Backtests, win-rate figures, and example P&amp;L are derived from historical data and do not represent guaranteed outcomes.</li>
            <li>You are the account holder at Alpaca (or any other broker you connect). EdgeNiq is a third-party application that acts on your stored instructions; we never become the account owner.</li>
          </ul>
        </Section>

        <Section title="Auto-trading (Alpaca integration)">
          <p>
            The Elite tier includes an auto-trading feature that
            submits bracket orders to your connected Alpaca paper
            account based on rules you configure on{" "}
            <Link href="/app/broker" className="underline">
              /app/broker
            </Link>
            . The Live Trading add-on (+$49.99/mo) unlocks live-mode
            submissions against real-money Alpaca accounts.
          </p>
          <ul>
            <li>
              <b>Paper mode</b> — orders route to Alpaca&rsquo;s
              paper-trading API. No real money at risk. The
              risk-rails + kill switch are identical to live.
            </li>
            <li>
              <b>Live mode</b> — real money, real orders. Enable only
              when you have validated your settings in paper. Every
              order is routed through your own Alpaca account; EdgeNiq
              merely submits the instructions you pre-authorized via
              your rule configuration.
            </li>
            <li>
              You can halt all orders instantly via the kill switch on
              the dashboard or <code>/kill YES</code> in the bot. Orders
              that have already filled are positions on your broker
              account and must be closed through Alpaca directly.
            </li>
            <li>
              We store your Alpaca API credentials encrypted
              (AES-256-GCM) and use them only to submit the orders
              your rules authorize. We do not withdraw funds, transfer
              assets, or take any action outside order placement and
              cancellation.
            </li>
          </ul>
        </Section>

        <Section title="Smart Money data">
          <p>
            The Smart Money feature aggregates public filings (SEC
            13F holdings and Form 4 insider transactions) from official
            government sources. These filings have inherent reporting
            delays — typically 2 days (insider Form 4) to 45 days (13F
            quarterly). You acknowledge that information surfaced via
            Smart Money is historical, not real-time, and positions
            may have changed since filing.
          </p>
          <p>
            The &ldquo;mirror&rdquo; sub-feature (requires Live Trading
            add-on) submits orders matching a followed entity&rsquo;s
            disclosed direction. This is an <b>instructional pass-
            through</b>, not a copy-trading service — you choose whom
            to mirror and the rules that size each trade.
          </p>
        </Section>

        <Section title="Subscription + billing">
          <p>
            Paid tiers renew monthly until canceled. Trial periods (7
            days of Elite access) convert to expired status at the end
            of the window — signals stop until you activate Pro,
            Elite, or the Live Trading add-on. Add-on and tier
            downgrades take effect at the next billing cycle.
          </p>
          <p>
            Until Stripe integration goes live, tier activation is a
            manual admin action. Contact the admin to upgrade or
            change plans.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            You agree not to redistribute signals, reverse-engineer
            the scoring system, scrape the web dashboard, or use the
            service for any purpose prohibited by US securities law.
            Circumventing tier gates (e.g., sharing an Elite
            credential across multiple real users) will terminate
            access for all involved accounts.
          </p>
        </Section>

        <Section title="Disclaimer of warranties">
          <p>
            EdgeNiq is provided &ldquo;as is&rdquo; without warranty of
            any kind. We do not guarantee signal accuracy, data-feed
            uptime, order-execution timing, or profitability. Your use
            of the service is at your own risk. To the maximum extent
            permitted by law, EdgeNiq&rsquo;s total liability for any
            claim is limited to the fees you paid in the 12 months
            preceding the claim.
          </p>
        </Section>

        <Section title="Changes + termination">
          <p>
            We may update these terms as the product evolves. Material
            changes trigger a re-acceptance prompt in the bot. You may
            terminate at any time via{" "}
            <code>/deleteaccount</code>; we reserve the right to
            terminate for breach of these terms.
          </p>
        </Section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          Questions? Contact the admin via Telegram or the email on the{" "}
          <Link href="/" className="underline">
            homepage
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-medium mt-6 mb-2">{title}</h2>
      {children}
    </div>
  );
}
