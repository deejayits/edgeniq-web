"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Smart Money follow/unfollow actions. Elite-gated (matches /app/broker);
// admins bypass. Mimic mode requires the Live add-on flag on users.

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireElite(): Promise<{
  chatId: number;
  hasLiveAddon: boolean;
}> {
  const session = await auth();
  const user = session?.user as
    | { tgUserId?: number; role?: string }
    | undefined;
  if (!user?.tgUserId) throw new Error("unauthorized");
  const isAdmin = user.role === "admin" || user.role === "primary_admin";
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("users")
    .select("sub_plan, sub_status, addon_live_trading")
    .eq("chat_id", user.tgUserId)
    .maybeSingle();
  if (!isAdmin) {
    const status = (data?.sub_status ?? "").toLowerCase();
    const plan = (data?.sub_plan ?? "").toLowerCase();
    const eliteish = status === "trial" || plan === "elite";
    if (!eliteish) {
      throw new Error(
        "Smart Money is an Elite feature. Upgrade to follow and mirror trades.",
      );
    }
  }
  return {
    chatId: user.tgUserId,
    hasLiveAddon: !!data?.addon_live_trading || isAdmin,
  };
}

export async function followTarget(
  targetId: string,
  opts: { alertOnTrades?: boolean; mimicOnTrades?: boolean; minSizeUsd?: number } = {},
): Promise<ActionResult> {
  const { chatId, hasLiveAddon } = await requireElite();
  // Mimic requires the Live add-on regardless of who's asking.
  if (opts.mimicOnTrades && !hasLiveAddon) {
    return {
      ok: false,
      error:
        "Mimic (auto-shadow-trade) requires the Live Trading add-on (+\$49.99/mo). Follow alert-only for now.",
    };
  }
  const sb = supabaseAdmin();
  const { error } = await sb.from("smart_money_follows").upsert(
    {
      chat_id: chatId,
      target_id: targetId,
      alert_on_trades: opts.alertOnTrades ?? true,
      mimic_on_trades: opts.mimicOnTrades ?? false,
      min_size_usd: opts.minSizeUsd ?? 0,
    },
    { onConflict: "chat_id,target_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/smart-money");
  return { ok: true };
}

export async function unfollowTarget(targetId: string): Promise<ActionResult> {
  const { chatId } = await requireElite();
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("smart_money_follows")
    .delete()
    .eq("chat_id", chatId)
    .eq("target_id", targetId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/smart-money");
  return { ok: true };
}

export async function toggleMimic(
  targetId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const { chatId, hasLiveAddon } = await requireElite();
  if (enabled && !hasLiveAddon) {
    return {
      ok: false,
      error:
        "Mimic requires the Live Trading add-on (+\$49.99/mo).",
    };
  }
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("smart_money_follows")
    .update({ mimic_on_trades: enabled })
    .eq("chat_id", chatId)
    .eq("target_id", targetId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/smart-money");
  return { ok: true };
}
