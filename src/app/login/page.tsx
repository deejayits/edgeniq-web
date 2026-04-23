import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BrandLockup } from "@/components/brand";
import { TelegramLoginButton } from "@/components/telegram-login-button";
import { env } from "@/env";

// Login page. Public. Renders the Telegram Login Widget which redirects
// to /api/auth/telegram/callback on success. `next` query param lets us
// bounce the user back to wherever they came from after sign-in.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reason?: string;
    tg_id?: string;
  }>;
}) {
  const params = await searchParams;
  const errorMsg = errorMessage(params.error, {
    reason: params.reason,
    tgId: params.tg_id,
  });

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center">
          <Link href="/" aria-label="EdgeNiq home">
            <BrandLockup iconSize={30} textClassName="text-lg" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md p-8 border-border/60 bg-card/50">
          <h1 className="text-2xl font-semibold mb-2">Log in</h1>
          <p className="text-sm text-muted-foreground mb-8">
            We use Telegram as the sign-in mechanism — same account you
            get signals on. No passwords.
          </p>

          {errorMsg && (
            <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-center py-4">
            <TelegramLoginButton
              botUsername={env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}
              next={params.next}
            />
          </div>

          <p className="mt-8 text-xs text-muted-foreground leading-relaxed">
            Not in the beta yet? Message{" "}
            <a
              href="https://t.me/EdgeNiqSupport"
              className="text-foreground hover:underline"
            >
              @EdgeNiqSupport
            </a>{" "}
            for access. Only existing bot users can sign in here.
          </p>
        </Card>
      </main>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <Link href="/legal/terms" className="hover:text-foreground mx-3">
          Terms
        </Link>
        <Link href="/legal/privacy" className="hover:text-foreground mx-3">
          Privacy
        </Link>
      </footer>
    </div>
  );
}

function errorMessage(
  code: string | undefined,
  ctx: { reason?: string; tgId?: string },
): string | null {
  if (!code) return null;
  switch (code) {
    case "telegram_hash":
      return `Telegram signature didn't validate${ctx.reason ? ` (${ctx.reason})` : ""}. The Login Widget payload may be stale — refresh and try again.`;
    case "supabase":
      return `Database error while looking up your account${ctx.reason ? `: ${ctx.reason}` : ""}. Try again; if it persists, ping the admin.`;
    case "no_bot_account":
      return `No bot account found for Telegram ID ${ctx.tgId ?? "?"}. You need to /start the bot on Telegram at least once before you can sign in here.`;
    case "account_deleted":
      return "This account is soft-deleted. Contact the admin to restore it.";
    case "signin_failed":
      return `Sign-in failed${ctx.reason ? `: ${ctx.reason}` : ""}. Try again.`;
    case "telegram_auth_failed":
      return "Telegram sign-in failed. Your session may be stale — try again.";
    case "CredentialsSignin":
      return "Sign-in rejected. Make sure your Telegram account has been invited to the bot.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
