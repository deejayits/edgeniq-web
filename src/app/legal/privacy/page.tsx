import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — EdgeNiq",
};

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
        Placeholder — the authoritative policy is delivered in the bot
        on first /start and re-acceptance for version bumps. This page
        will mirror the same content once rendering is wired up.
      </p>
      <div className="text-sm leading-relaxed space-y-4">
        <h2 className="text-lg font-medium">What we collect</h2>
        <p>
          Telegram chat_id, display name, and the preferences you set
          via bot commands (risk profile, watchlist, session-alert
          toggles). Every signal you confirm and every trade outcome is
          logged to build your dashboard stats.
        </p>
        <h2 className="text-lg font-medium">What we don&rsquo;t collect</h2>
        <p>
          We do not connect to your brokerage. We do not see your
          account balance, real positions, or any banking info.
          &ldquo;Entry price&rdquo; means the price you manually confirm
          in the bot — nothing is executed on your behalf.
        </p>
        <h2 className="text-lg font-medium">Your rights</h2>
        <p>
          Run /exportmydata to get a JSON dump of everything we have.
          Run /deleteaccount to have your record soft-deleted; the
          tombstone survives for the legally-mandated period then is
          fully purged.
        </p>
      </div>
    </div>
  );
}
