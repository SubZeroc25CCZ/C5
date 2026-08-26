import type { Metadata } from "next";
import { PricingPlans } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing — SubZero",
  description:
    "The scan is free and shows your totals plus your most expensive subscription. Basic unlocks everything from $4.99/month; Pro adds unlimited inboxes, daily sync, and alerts.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-4xl font-extrabold tracking-tight">
        Simple, honest pricing
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">
        Scan for free and see what you&rsquo;re dealing with — your totals and your most expensive
        subscription, evidence included. Unlock the full list when you&rsquo;re ready.
      </p>

      <div className="mt-12">
        <PricingPlans />
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        Payments are handled by Stripe. We never see your card details — fitting, for a
        subscription-cancellation service, to make our own easy to cancel.
      </p>
    </main>
  );
}
