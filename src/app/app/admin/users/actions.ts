"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

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
  revalidatePath("/app/admin/users");
  return { ok: true };
}
