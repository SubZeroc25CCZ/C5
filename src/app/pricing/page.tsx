import type { Metadata } from "next";
import { PricingPlans } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing — SubZero",
  description:
    "The scan is free and shows your totals plus your most expensive subscription. One $14.99 payment unlocks everything for 30 days; Guardian keeps watch for $19/year.",
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
        Payments are handled by Stripe — we never see your card details. And no, the Pass is not
        a subscription: a service that cancels subscriptions shouldn&rsquo;t make you buy one.
      </p>
    </main>
  );
}
