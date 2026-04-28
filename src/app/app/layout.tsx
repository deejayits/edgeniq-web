import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { BrandLockup } from "@/components/brand";
import { CommandPalette } from "@/components/command-palette";
import { UserMenu } from "@/components/user-menu";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/env";

// Protected dashboard shell. Middleware already gates /app/** but we
// re-verify the session here so server components downstream can trust
// the session object. Also exposes the user to the nav.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/app");
  }
  const user = session.user as {
    name?: string | null;
    image?: string | null;
    tgUserId?: number;
    role?: string;
    subPlan?: string;
  };
  const isAdmin = user.role === "admin" || user.role === "primary_admin";

  // Stale-terms detection. Acceptance is bot-side authoritative
  // (the bot collects + stamps the version on /start), so the web
  // can't accept on the user's behalf — but we CAN tell them their
  // signals are paused and where to fix it. Skipped for admins
  // since they're exempt from the bot-side stale-terms gate too.
  let staleTerms: { acked: string; current: string } | null = null;
  if (user.tgUserId && !isAdmin) {
    try {
      const db = supabaseAdmin();
      const { data } = await db
        .from("users")
        .select("terms_accepted_version")
        .eq("chat_id", user.tgUserId)
        .maybeSingle();
      const acked = (data?.terms_accepted_version ?? "").trim();
      const current = env.PRIVACY_VERSION;
      if (current && acked !== current) {
        staleTerms = { acked: acked || "—", current };
      }
    } catch {
      // Network blip → don't block the page; bot-side gate is the
      // authoritative consent enforcement, the banner is just UX.
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border/40 bg-background/70 backdrop-blur-md sticky top-0 z-30 supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/app"
              aria-label="EdgeNiq home"
              className="opacity-90 hover:opacity-100 transition-opacity"
            >
              <BrandLockup iconSize={30} textClassName="text-lg" />
            </Link>
            <AppNav isAdmin={isAdmin} />
          </div>
          <UserMenu
            name={user.name ?? ""}
            image={user.image ?? null}
            role={user.role ?? "user"}
            subPlan={user.subPlan ?? "free"}
          />
        </div>
      </header>

      {staleTerms && (
        <div className="border-b border-amber-400/40 bg-amber-400/5">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-100/90 leading-relaxed">
              <span className="font-medium text-amber-200">
                Privacy policy updated to v{staleTerms.current}.
              </span>{" "}
              You acknowledged v{staleTerms.acked}. Signals are paused
              for your account until you re-accept on Telegram.{" "}
              <Link
                href={`https://t.me/${env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`}
                className="underline underline-offset-2 hover:text-amber-50"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the bot →
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-10">
        {children}
      </main>

      <CommandPalette />
    </div>
  );
}
