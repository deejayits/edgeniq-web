"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendBotDMFireAndForget } from "@/lib/telegram-notify";

// All actions re-verify admin role before mutating. The outer layout
// check is a UX gate, not a security boundary — server actions can be
// invoked directly, so the role check has to live here too.
async function assertAdmin(): Promise<void> {
  const session = await auth();
  const role =
    (session?.user as { role?: string } | undefined)?.role ?? "user";
  if (role !== "admin" && role !== "primary_admin") {
    throw new Error("forbidden");
  }
}

// Free tier no longer exists — every new user gets a one-time 7-day
// trial via /start, then must pick Pro or Elite. The dropdown is
// strictly the activation path post-trial. Use expireUser() to
// revoke access; use grantTrial() to give a fresh trial.
const VALID_PLANS = ["pro", "elite"] as const;
type Plan = (typeof VALID_PLANS)[number];

// setUserPlan(chatId, plan) — activate the user at the given paid
// tier, clearing any "trial" or "expired" status so they start
// receiving signals again immediately. Mirrors the bot's /setplan
// behavior.
export async function setUserPlan(
  chatId: number,
  plan: string,
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  if (!VALID_PLANS.includes(plan as Plan)) {
    return { ok: false, error: `invalid plan: ${plan}` };
  }
  const { error } = await supabaseAdmin()
    .from("users")
    .update({ sub_plan: plan, sub_status: "active" })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  // Plan upgrade is the user's most material billing event — they
  // need to know their access changed. Welcome them to the new
  // tier with a quick orientation.
  const headline =
    plan === "elite"
      ? "🎉 <b>Welcome to Elite</b>"
      : plan === "pro"
        ? "✅ <b>Welcome to Pro</b>"
        : "✅ <b>Plan updated</b>";
  const tierBenefits =
    plan === "elite"
      ? "All features unlocked: stocks (whole-market + watchlist), " +
        "options, Smart Money, prediction markets, ETF directional " +
        "calls, auto-trade with bracket orders + breakeven shift."
      : plan === "pro"
        ? "Stock signals for tickers on your watchlist · 3 risk presets " +
          "+ custom · live position monitor · /today, /history, " +
          "/portfolio, /mystats."
        : `Your plan is now ${plan}.`;
  sendBotDMFireAndForget(
    chatId,
    `${headline}\n\n${tierBenefits}\n\n` +
      "<i>Plan changed by admin. /pricing for the full feature " +
      "matrix · /help for the command list.</i>",
  );
  revalidatePath("/app/admin/users");
  return { ok: true };
}

// grantTrial(chatId) — clear trial_used_at AND drop the user into a
// fresh 7-day trial state. For legitimate support cases only:
// account migration after a Telegram login switch, lost access
// during onboarding, etc. With Free tier removed, this is the
// only "give them another shot" lever.
//
// Idempotent: a user already on trial just gets their expiry pushed
// out to now+7d and trial_used_at refreshed to now.
export async function grantTrial(
  chatId: number,
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { error } = await supabaseAdmin()
    .from("users")
    .update({
      sub_plan: "elite",
      sub_status: "trial",
      sub_started_at: now.toISOString(),
      sub_expires_at: expires.toISOString(),
      trial_used_at: now.toISOString(),
      // Reset the warning flags so the new trial doesn't immediately
      // fire a "1 day left" reminder if the previous trial was close
      // to expiry.
      trial_warned: false,
      trial_expired_notified: false,
    })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  sendBotDMFireAndForget(
    chatId,
    "🎁 <b>Fresh 7-day trial granted</b>\n" +
      "\n" +
      "All Elite features unlocked: stocks (whole-market + " +
      "watchlist), options, Smart Money, prediction markets, " +
      "ETF directional calls, auto-trade.\n" +
      "\n" +
      "Trial expires in 7 days. /pricing to compare tiers when " +
      "you're ready to pick one.",
  );
  revalidatePath("/app/admin/users");
  return { ok: true };
}

// resetTrialEligibility(chatId) — clear trial_used_at WITHOUT
// granting a trial right now. Lets a user trigger their own trial
// next time they /start. Use this when an admin wants to "wipe
// the slate" but let the user decide when to begin the clock.
export async function resetTrialEligibility(
  chatId: number,
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const { error } = await supabaseAdmin()
    .from("users")
    .update({ trial_used_at: null })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/admin/users");
  return { ok: true };
}

// expireUser(chatId) — force-expire a user. Blocks signals without
// deleting anything. Used when revoking paid access (e.g. non-payment).
export async function expireUser(
  chatId: number,
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const { error } = await supabaseAdmin()
    .from("users")
    .update({ sub_status: "expired" })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  sendBotDMFireAndForget(
    chatId,
    "🔒 <b>Access expired</b>\n" +
      "\n" +
      "Your EdgeNiq subscription has been deactivated. Signals will " +
      "stop until a plan is reactivated.\n" +
      "\n" +
      "<i>Contact the admin if this was unexpected. Your watchlist " +
      "+ preferences are preserved — they'll be active again the " +
      "moment a plan is restored.</i>",
  );
  revalidatePath("/app/admin/users");
  return { ok: true };
}

// setUserStatus(chatId, status) — active | suspended. Suspended users
// can't run any bot commands; used for abuse / ToS violations.
export async function setUserStatus(
  chatId: number,
  status: "active" | "suspended",
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const { error } = await supabaseAdmin()
    .from("users")
    .update({ status })
    .eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  // Restore-only DM: sending a "you've been suspended" Telegram is
  // intentionally skipped because the suspended user can't act on it
  // and the bot will refuse their commands anyway. Restoring users
  // DO get a heads-up so they know they can come back.
  if (status === "active") {
    sendBotDMFireAndForget(
      chatId,
      "✅ <b>Access restored</b>\n" +
        "\n" +
        "Your EdgeNiq access is active again. Signals will resume on " +
        "the next scanner tick. /status for current state.",
    );
  }
  revalidatePath("/app/admin/users");
  return { ok: true };
}
