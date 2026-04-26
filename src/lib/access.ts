// Tier-access helpers — single source of truth for whether a user
// can use Elite-tier features. Mirrors notifications/users.has_elite_access
// in the bot, so a user who's gated by the bot for /smartmoney is also
// gated by the web for /app/smart-money. Drift between bot and web on
// what counts as "Elite" was an inevitability with copy-pasted helpers
// in every page; consolidating here so it's one edit if rules change.
//
// The rule:
//   admin / primary_admin  → always Elite (bypass all tier gates)
//   sub_status === expired → blocked even if sub_plan === elite (paid
//                            but lapsed)
//   sub_status === trial   → Elite during the trial window regardless
//                            of sub_plan (default trial is 7 days)
//   else                   → Elite only if sub_plan === elite
//
// Pro check follows the same shape — admin bypass, expired blocks,
// trial unlocks, otherwise plan ∈ {pro, elite}.

export type AccessUser = {
  role?: string;
  subPlan?: string;
  subStatus?: string;
};

export function isEliteAccess(user: AccessUser): boolean {
  if (user.role === "admin" || user.role === "primary_admin") return true;
  const status = (user.subStatus ?? "").toLowerCase();
  if (status === "expired") return false;
  if (status === "trial") return true;
  return (user.subPlan ?? "").toLowerCase() === "elite";
}

export function isProAccess(user: AccessUser): boolean {
  if (user.role === "admin" || user.role === "primary_admin") return true;
  const status = (user.subStatus ?? "").toLowerCase();
  if (status === "expired") return false;
  if (status === "trial") return true;
  const plan = (user.subPlan ?? "").toLowerCase();
  return plan === "pro" || plan === "elite";
}
