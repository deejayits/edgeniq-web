import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { billingEnabled, stripeClient } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST /api/stripe/webhook — Stripe calls this when a subscription
// event happens. We verify the signature, interpret the event, and
// update the matching EdgeNiq user's sub_plan / sub_status in
// Supabase so the bot's has_pro_access / has_elite_access gates are
// always consistent with billing reality.
//
// Events we care about:
//   checkout.session.completed    → user paid, activate their tier
//   customer.subscription.updated → plan changes (upgrade/downgrade)
//   customer.subscription.deleted → cancellation/non-payment → expire
//   invoice.payment_failed        → keep active for now, log for review

// Next.js App Router wants us to read the raw body for signature
// verification; middleware doesn't auto-parse webhooks.
export async function POST(req: NextRequest) {
  if (!billingEnabled()) {
    return NextResponse.json(
      { error: "billing_disabled" },
      { status: 503 },
    );
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "webhook_secret_missing" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "missing_signature" },
      { status: 400 },
    );
  }
  const raw = await req.text();

  const stripe = stripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (exc) {
    console.error("stripe webhook signature verification failed", exc);
    return NextResponse.json(
      { error: "bad_signature" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const sess = event.data.object as {
          client_reference_id: string | null;
          customer: string | null;
          subscription: string | null;
          metadata?: Record<string, string>;
        };
        const chatId = sess.client_reference_id
          ? Number(sess.client_reference_id)
          : null;
        if (!chatId || Number.isNaN(chatId)) {
          console.warn("checkout.session.completed without chat_id");
          break;
        }
        const plan = await planFromSubscription(sess.subscription);
        if (plan) {
          await supabaseAdmin()
            .from("users")
            .update({
              sub_plan: plan,
              sub_status: "active",
              stripe_customer_id: sess.customer,
            })
            .eq("chat_id", chatId);
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as {
          id: string;
          status: string;
          customer: string;
          items: { data: Array<{ price: { id: string } }> };
        };
        const chatId = await chatIdFromCustomer(sub.customer);
        if (!chatId) break;
        const priceId = sub.items.data[0]?.price.id;
        const plan = planFromPriceId(priceId);
        const status =
          sub.status === "active" || sub.status === "trialing"
            ? "active"
            : "expired";
        await supabaseAdmin()
          .from("users")
          .update({
            ...(plan ? { sub_plan: plan } : {}),
            sub_status: status,
          })
          .eq("chat_id", chatId);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as { customer: string };
        const chatId = await chatIdFromCustomer(sub.customer);
        if (!chatId) break;
        await supabaseAdmin()
          .from("users")
          .update({ sub_status: "expired" })
          .eq("chat_id", chatId);
        break;
      }
      default:
        // Unhandled event types are fine — just ack 200 so Stripe
        // doesn't retry, but don't pretend we did anything.
        break;
    }
    return NextResponse.json({ received: true });
  } catch (exc) {
    console.error("stripe webhook handler threw", exc);
    return NextResponse.json(
      { error: "handler_error" },
      { status: 500 },
    );
  }
}

function planFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ID_ELITE) return "elite";
  return null;
}

async function planFromSubscription(
  subId: string | null,
): Promise<string | null> {
  if (!subId) return null;
  try {
    const sub = await stripeClient().subscriptions.retrieve(subId);
    const priceId = sub.items.data[0]?.price.id;
    return planFromPriceId(priceId);
  } catch (exc) {
    console.error("failed to resolve plan for subscription", subId, exc);
    return null;
  }
}

async function chatIdFromCustomer(
  customerId: string,
): Promise<number | null> {
  const { data, error } = await supabaseAdmin()
    .from("users")
    .select("chat_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error || !data) return null;
  return data.chat_id;
}
