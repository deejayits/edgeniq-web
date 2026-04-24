import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { env } from "@/env";
import {
  billingEnabled,
  priceIdForPlan,
  stripeClient,
  type Plan,
} from "@/lib/stripe";

// POST /api/stripe/checkout — creates a Stripe Checkout session for
// the authenticated user at the specified plan and redirects them
// through Stripe's hosted payment flow. When BILLING_ENABLED is false
// returns 503 so the frontend can fall back to "contact admin" UX.
export async function POST(req: NextRequest) {
  if (!billingEnabled()) {
    return NextResponse.json(
      {
        error: "billing_disabled",
        message:
          "Self-serve billing isn't enabled yet. Contact the admin to activate your plan.",
      },
      { status: 503 },
    );
  }

  const session = await auth();
  const user = session?.user as
    | {
        tgUserId?: number;
        name?: string | null;
        email?: string | null;
      }
    | undefined;
  if (!user?.tgUserId) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }
  const plan = body.plan as Plan | undefined;
  if (plan !== "pro" && plan !== "elite") {
    return NextResponse.json(
      { error: "invalid_plan", message: "plan must be 'pro' or 'elite'" },
      { status: 400 },
    );
  }
  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json(
      {
        error: "price_unconfigured",
        message: `Price ID for ${plan} not set in env`,
      },
      { status: 500 },
    );
  }

  try {
    const checkout = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // client_reference_id carries the Telegram chat_id so the
      // webhook can map the Stripe subscription back to the right
      // EdgeNiq user without needing a separate email->chat_id lookup.
      client_reference_id: String(user.tgUserId),
      success_url: `${env.NEXT_PUBLIC_APP_URL}/app?billing=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/?billing=canceled#pricing`,
      allow_promotion_codes: true,
    });
    if (!checkout.url) {
      return NextResponse.json(
        { error: "no_checkout_url" },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: checkout.url });
  } catch (exc) {
    console.error("stripe checkout failed", exc);
    return NextResponse.json(
      {
        error: "stripe_error",
        message: exc instanceof Error ? exc.message : "unknown",
      },
      { status: 500 },
    );
  }
}
