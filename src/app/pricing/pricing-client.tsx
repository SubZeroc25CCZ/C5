"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc";
import { Button, cx } from "@/components/ui";
import { planById, PLANS } from "@/lib/plans";

type PaidPlan = "basic" | "pro";

// Names, prices and bullets come from src/lib/plans.ts — the one place they
// are allowed to live (D10 A1). These aliases keep the JSX below readable.
const PRICING: Record<PaidPlan, Record<Interval, string>> = {
  basic: { monthly: planById("basic").monthly, annual: planById("basic").annual! },
  pro: { monthly: planById("pro").monthly, annual: planById("pro").annual! },
};
const TEASER_FEATURES = planById("teaser").features;
const BASIC_FEATURES = planById("basic").features;
const PRO_FEATURES = planById("pro").features;
type Interval = "monthly" | "annual";


function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-frost"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}




export function PricingPlans() {
  const [interval, setInterval] = useState<Interval>("monthly");
  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-line bg-surface p-1 text-sm">
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setInterval(option)}
              className={cx(
                "cursor-pointer rounded-full px-4 py-1.5 transition-colors",
                interval === option ? "bg-frost font-semibold text-frost-ink" : "text-muted",
              )}
            >
              {option === "monthly" ? "Monthly" : "Annual · 2 months free"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Teaser */}
        <div className="rounded-2xl border border-line bg-surface p-7">
          <h2 className="text-lg font-semibold">Free scan</h2>
          <p className="tnum mt-2 text-4xl font-extrabold">{planById("teaser").monthly}</p>
          <p className="mt-1 text-sm text-muted">see what you&rsquo;re dealing with</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {TEASER_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <Check />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            The rest of your subscriptions stay locked until you upgrade — no re-scans, no
            cancellation tools.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center rounded-lg border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Start the free scan
            </Link>
          </div>
        </div>

        {/* Basic */}
        <div className="relative rounded-2xl border-2 border-frost bg-surface p-7">
          <span className="absolute -top-3 left-6 rounded-full bg-frost px-3 py-0.5 text-xs font-bold text-frost-ink">
            MOST POPULAR
          </span>
          <h2 className="text-lg font-semibold text-frost">Basic</h2>
          <p className="tnum mt-2 text-4xl font-extrabold">
            {PRICING.basic[interval]}
            <span className="text-lg font-medium text-muted">
              /{interval === "monthly" ? "month" : "year"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">cancel anytime — of course</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {BASIC_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <Check />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <PlanAction plan="basic" interval={interval} />
          </div>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border border-line bg-surface p-7">
          <h2 className="text-lg font-semibold">Pro</h2>
          <p className="tnum mt-2 text-4xl font-extrabold">
            {PRICING.pro[interval]}
            <span className="text-lg font-medium text-muted">
              /{interval === "monthly" ? "month" : "year"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">for people with many inboxes</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <Check />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <PlanAction plan="pro" interval={interval} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The plan card's action button: sign in → upgrade → manage, by state. */
function PlanAction({ plan, interval }: { plan: PaidPlan; interval: Interval }) {
  const { isSignedIn } = useAuth();
  const planQuery = trpc.billing.plan.useQuery(undefined, { enabled: !!isSignedIn });
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
  const portal = trpc.billing.portal.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <Button className="w-full py-3">Sign in to upgrade</Button>
      </SignInButton>
    );
  }
  const current = planQuery.data?.plan;
  if (current === plan) {
    return (
      <Button
        variant="secondary"
        className="w-full py-3"
        disabled={portal.isPending}
        onClick={() => portal.mutate()}
      >
        {portal.isPending ? "Opening billing…" : "Current plan — manage billing"}
      </Button>
    );
  }
  return (
    <div>
      <Button
        className="w-full py-3"
        disabled={checkout.isPending || planQuery.isLoading}
        onClick={() => checkout.mutate({ plan, interval })}
      >
        {checkout.isPending
          ? "Opening checkout…"
          : `Get ${plan === "basic" ? "Basic" : "Pro"}`}
      </Button>
      {checkout.isError ? (
        // Honesty rule: don't tell someone to retry a thing that cannot
        // succeed. A failed checkout is almost always our configuration,
        // not their click, so say so and give them a way to reach us.
        <p className="mt-2 text-center text-xs text-danger">
          Checkout didn&rsquo;t open. That&rsquo;s a problem on our side, not yours — nothing was
          charged. Email{" "}
          <a href="mailto:support@subzero.o2c.one" className="underline">
            support@subzero.o2c.one
          </a>{" "}
          and we&rsquo;ll sort it.
        </p>
      ) : null}
    </div>
  );
}
