import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ShieldAlert, Clock } from "lucide-react";
import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { BrandLockup } from "@/components/brand";
import { CommandPalette } from "@/components/command-palette";
import { UserMenu } from "@/components/user-menu";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/env";
import {
  computeMacroState,
  macroEventLabel,
  type MacroEventRow,
  type MacroState,
} from "@/lib/macro-blackout";

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

  // Stale-terms detection + macro blackout state, fetched in
  // parallel from Supabase so layout overhead stays low.
  let staleTerms: { acked: string; current: string } | null = null;
  let macro: MacroState = { phase: "clear" };
  try {
    const db = supabaseAdmin();
    const [termsRes, eventsRes] = await Promise.all([
      user.tgUserId && !isAdmin
        ? db
            .from("users")
            .select("terms_accepted_version")
            .eq("chat_id", user.tgUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from("macro_events")
        .select("event_date, time_et, kind, weight, title")
        .gte(
          "event_date",
          new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10),
        )
        .order("event_date", { ascending: true })
        .limit(20),
    ]);
    const acked = (
      (termsRes as { data: { terms_accepted_version?: string } | null }).data
        ?.terms_accepted_version ?? ""
    ).trim();
    const current = env.PRIVACY_VERSION;
    if (
      user.tgUserId
      && !isAdmin
      && current
      && acked !== current
    ) {
      staleTerms = { acked: acked || "—", current };
    }
    const rows = (eventsRes as { data: MacroEventRow[] | null }).data ?? [];
    macro = computeMacroState(rows);
  } catch {
    // Network blip → leave both states empty; bot-side gates are
    // the authoritative protections, banners are UX.
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

      {macro.phase === "blocked" && (
        <div className="border-b border-rose-400/40 bg-rose-400/10">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-start gap-3">
            <ShieldAlert className="h-4 w-4 text-rose-300 mt-0.5 shrink-0" />
            <div className="text-sm text-rose-100/90 leading-relaxed">
              <span className="font-medium text-rose-200">
                Auto-trade paused — {macroEventLabel(macro.event)} window.
              </span>{" "}
              Bot blocks new entries {macro.pre} min before / {macro.post}{" "}
              min after this event ({macro.event.time_et} ET) to avoid
              announcement-driven whipsaws. Manual signals continue to flow.
            </div>
          </div>
        </div>
      )}

      {macro.phase === "approaching" && (
        <div className="border-b border-amber-400/30 bg-amber-400/5">
          <div className="mx-auto max-w-7xl px-6 py-2.5 flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-100/80 leading-relaxed">
              Heads up:{" "}
              <span className="font-medium text-amber-200">
                {macroEventLabel(macro.event)}
              </span>{" "}
              at {macro.event.time_et} ET (in {macro.minutesUntil} min) —
              auto-trade entries pause around the announcement.
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
