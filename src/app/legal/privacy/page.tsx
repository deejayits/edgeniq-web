import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — EdgeNiq",
};

const LAST_UPDATED = "2026-04-24";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-sm">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block"
      >
        ← Back
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Last updated: {LAST_UPDATED}
      </p>

      <div className="text-sm leading-relaxed space-y-5">
        <Section title="TL;DR">
          <p>
            We collect the minimum needed to deliver signals to your
            Telegram account and (optionally) to place orders on your
            connected Alpaca account. All broker credentials are
            encrypted at rest. Run <code>/exportmydata</code> any time
            to see exactly what we hold.
          </p>
        </Section>

        <Section title="What we collect">
          <ul>
            <li>
              <b>Identity</b>: Telegram chat ID, first name / last name
              / username / photo URL (all fields Telegram sends on
              login).
            </li>
            <li>
              <b>Preferences</b>: risk profile, watchlist, strategy
              templates, session-alert toggles, signal min-score, and
              auto-trade rules.
            </li>
            <li>
              <b>Signal + trade history</b>: every signal we deliver,
              every confirmation you tap (&ldquo;I took this&rdquo;),
              and every auto-trade order we submit on your behalf.
              Used to build your <code>/portfolio</code> and{" "}
              <code>/history</code>.
            </li>
            <li>
              <b>Broker credentials (when connected)</b>: your Alpaca
              API key ID and secret key. <b>Both are encrypted
              (AES-256-GCM) before writing to our database.</b> The
              plaintext exists only in server memory during order
              submission. Supabase admins cannot read your keys.
            </li>
            <li>
              <b>Smart Money follow state</b>: which politicians / funds
              / insiders you follow and whether mirror mode is enabled.
            </li>
            <li>
              <b>Operational logs</b>: last seen timestamp, bot command
              usage for rate-limiting and abuse prevention.
            </li>
          </ul>
        </Section>

        <Section title="What we do NOT collect">
          <ul>
            <li>
              Banking, credit-card, or SSN info. Billing (when Stripe
              goes live) is handled by Stripe; we receive only
              Stripe&rsquo;s subscription status, never card numbers.
            </li>
            <li>
              Your Alpaca account balance, positions, or trade history
              beyond what we submitted via the auto-trader. We
              explicitly do not pull your full position list from
              Alpaca.
            </li>
            <li>Browsing behavior outside edgeniq.com.</li>
            <li>
              Telegram messages that don&rsquo;t contain bot commands.
              We don&rsquo;t read your other chats.
            </li>
          </ul>
        </Section>

        <Section title="How we use it">
          <ul>
            <li>Deliver signals to the Telegram account you logged in with.</li>
            <li>
              Submit bracket orders to Alpaca according to the rules
              <i> you</i> configured on <code>/app/broker</code>. The
              kill switch halts everything.
            </li>
            <li>
              Track performance so you see real win rates in{" "}
              <code>/performance</code> and <code>/accuracy</code>.
            </li>
            <li>
              Aggregate anonymized metrics (signal-level win rates per
              ticker, for example) to improve the scoring model. Your
              personal identity is never in the aggregate.
            </li>
          </ul>
        </Section>

        <Section title="What we share — and don't">
          <ul>
            <li>
              <b>Alpaca</b> receives your API credentials (because they
              belong to you) and the order instructions we submit on
              your behalf. That&rsquo;s required for the broker
              integration to work.
            </li>
            <li>
              <b>Supabase</b> hosts our database. They have access to
              encrypted data at rest — but not the encryption key
              (which sits in Vercel env, not in the DB).
            </li>
            <li>
              <b>Vercel</b> hosts the web app; they see HTTP request
              logs. They do not see decrypted broker credentials.
            </li>
            <li>
              <b>Telegram</b> handles message delivery. They see the
              signal content we send you (because we send it to them),
              but not our internal data.
            </li>
            <li>
              We do not sell your data. We do not share it with
              advertisers, brokers-other-than-Alpaca, or third-party
              marketing.
            </li>
          </ul>
        </Section>

        <Section title="Encryption details">
          <p>
            Broker API credentials are encrypted with AES-256-GCM
            using a 32-byte master key held as a Vercel / VPS
            environment variable (<code>TRADING_ENCRYPTION_KEY</code>).
            Each credential gets a random 12-byte initialization
            vector. Even a full database dump would require separate
            compromise of the environment-variable store to decrypt
            anything. We rotate the master key on compromise and
            re-encrypt every stored credential at the same time.
          </p>
        </Section>

        <Section title="Data retention">
          <ul>
            <li>
              <b>Active account</b>: we retain your data as long as
              your account is active plus 12 months for audit + tax
              purposes.
            </li>
            <li>
              <b>Soft-deleted accounts</b> (after{" "}
              <code>/deleteaccount</code>): we keep a tombstone for 30
              days (in case of accidental deletion) then fully purge
              PII. Signal-history records are anonymized (chat_id
              replaced with a hashed token) so aggregate stats remain
              accurate.
            </li>
            <li>
              <b>Broker credentials</b> are purged immediately upon
              disconnection (not soft-deleted).
            </li>
          </ul>
        </Section>

        <Section title="Your rights">
          <ul>
            <li>
              <code>/mydata</code> — see every field we hold about
              you, inline in the bot.
            </li>
            <li>
              <code>/exportmydata</code> — download a full JSON export
              as a file attachment.
            </li>
            <li>
              <code>/deleteaccount</code> — start the soft-delete
              flow. Two-step (type confirmation in bot).
            </li>
            <li>
              To disconnect Alpaca specifically without deleting the
              rest of your account, use the <b>Disconnect</b> button
              on <code>/app/broker</code>.
            </li>
          </ul>
        </Section>

        <Section title="Compliance">
          <p>
            We follow GDPR + CCPA data-subject-rights obligations even
            for users not in those jurisdictions. If you&rsquo;re in
            the EU / UK / California and need a formal privacy request
            (portability, rectification, erasure), contact the admin
            with your request type and we&rsquo;ll process within 30
            days.
          </p>
        </Section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border/40">
          See also our{" "}
          <Link href="/legal/terms" className="underline">
            Terms of Service
          </Link>{" "}
          for what signals mean legally and how auto-trading
          responsibility is allocated.
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
