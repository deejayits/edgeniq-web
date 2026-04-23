import Link from "next/link";
import { Card } from "@/components/ui/card";
import { TelegramLoginButton } from "@/components/telegram-login-button";
import { env } from "@/env";

// Login page. Public. Renders the Telegram Login Widget which redirects
// to /api/auth/telegram/callback on success. `next` query param lets us
// bounce the user back to wherever they came from after sign-in.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = errorMessage(params.error);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center">
          <Link href="/" className="font-semibold tracking-tight">
            Edge<span className="text-primary">Niq</span>
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

function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "telegram_auth_failed":
      return "Telegram sign-in failed. Your session may be stale — try again.";
    case "CredentialsSignin":
      return "Sign-in rejected. Make sure your Telegram account has been invited to the bot.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
