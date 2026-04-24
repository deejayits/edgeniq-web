import Stripe from "stripe";
import { env } from "@/env";

// Stripe scaffold — everything here is a no-op when BILLING_ENABLED is
// false. When you're ready to launch billing:
//   1. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and the price
//      IDs in env (STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_ELITE).
//   2. Flip BILLING_ENABLED=true.
//   3. Configure the webhook endpoint in Stripe dashboard to point at
//      /api/stripe/webhook.

// Stripe plan identifiers matching the pricing page. These are the
// *internal* plan names; the external Stripe Price IDs live in env.
export type Plan = "pro" | "elite";

export const PLAN_DISPLAY: Record<Plan, { name: string; price: string }> = {
  pro: { name: "Pro", price: "$49.99/mo" },
  elite: { name: "Elite", price: "$99.99/mo" },
};

export function billingEnabled(): boolean {
  return env.BILLING_ENABLED === true && !!env.STRIPE_SECRET_KEY;
}

// Lazy Stripe client init — avoids crashing when STRIPE_SECRET_KEY is
// unset during the pre-launch phase. Callers must check billingEnabled()
// first; this will throw if the key is missing.
let _stripe: Stripe | null = null;
export function stripeClient(): Stripe {
  if (_stripe) return _stripe;
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    // Pin to a specific API version to prevent surprise changes on
    // Stripe's rolling updates. Bump this deliberately during upgrade
    // windows, not accidentally via dependency updates.
    apiVersion: "2026-04-22.dahlia",
  });
  return _stripe;
}

// Resolve a plan → Stripe Price ID. Reads env at call-time so rotating
// price IDs between staging and prod doesn't need a redeploy.
export function priceIdForPlan(plan: Plan): string | undefined {
  if (plan === "pro") return process.env.STRIPE_PRICE_ID_PRO;
  if (plan === "elite") return process.env.STRIPE_PRICE_ID_ELITE;
  return undefined;
}
