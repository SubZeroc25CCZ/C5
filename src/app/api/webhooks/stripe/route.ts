import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db/client";
import { drizzleBillingStore, processStripeEvent, stripeClient } from "@/services/stripe";

// Signed + idempotent (§8 P0): signature is verified against the raw body
// before anything is parsed; event ids are recorded so replays are no-ops.

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const outcome = await processStripeEvent(drizzleBillingStore(db), event);
  return NextResponse.json({ received: true, ...outcome });
}
