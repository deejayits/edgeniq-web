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

const VALID_PLANS = ["free", "pro", "elite"] as const;
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
