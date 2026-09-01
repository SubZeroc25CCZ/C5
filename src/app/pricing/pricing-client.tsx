"use client";

import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc";
import { Button, cx } from "@/components/ui";
import { GUARDIAN, PASS, planById, type PlanId } from "@/lib/plans";

// Names, prices and bullets come from src/lib/plans.ts — the one place they
// are allowed to live (D10 A1). This file only lays them out.

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

function TierCard({
  id,
  flag,
  footnote,
  children,
}: {
  id: PlanId;
  flag?: string;
  footnote?: string;
  children: React.ReactNode;
}) {
  const plan = planById(id);
  return (
    <div
      className={cx(
        "relative rounded-2xl bg-surface p-7",
        plan.featured ? "border-2 border-frost" : "border border-line",
      )}
    >
      {flag && (
        <span className="absolute -top-3 left-6 rounded-full bg-frost px-3 py-0.5 text-xs font-bold text-frost-ink">
          {flag}
        </span>
      )}
      <h2 className={cx("text-lg font-semibold", plan.featured && "text-frost")}>{plan.name}</h2>
      <p className="tnum mt-2 text-4xl font-extrabold">
        {plan.price}
        {plan.cadence && (
          <span className="text-lg font-medium text-muted"> {plan.cadence}</span>
        )}
      </p>
      <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
      <ul className="mt-6 space-y-2.5 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <Check />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {footnote && <p className="mt-4 text-xs text-muted">{footnote}</p>}
      <div className="mt-7">{children}</div>
    </div>
  );
}

export function PricingPlans() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <TierCard
        id="free"
        footnote="The rest of your subscriptions stay locked until you buy the Pass — no re-scans, no cancellation tools."
      >
        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center rounded-lg border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          Start the free scan
        </Link>
      </TierCard>

      <TierCard id="pass" flag="THE UNLOCK">
        <PurchaseAction purchase="pass" />
      </TierCard>

      <TierCard
        id="guardian"
        footnote="Best bought after the cleanup — it exists so the mess never rebuilds."
      >
        <PurchaseAction purchase="guardian" />
      </TierCard>
    </div>
  );
}

/** The tier card's action button: sign in → buy → manage, by state. */
function PurchaseAction({ purchase }: { purchase: "pass" | "guardian" }) {
  const { isSignedIn } = useAuth();
  const accessQuery = trpc.billing.plan.useQuery(undefined, { enabled: !!isSignedIn });
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
        <Button className="w-full py-3">Sign in to buy</Button>
      </SignInButton>
    );
  }

  const access = accessQuery.data?.access;
  const passExpiresAt = accessQuery.data?.passExpiresAt;

  if (purchase === "guardian" && access === "guardian") {
    return (
      <Button
        variant="secondary"
        className="w-full py-3"
        disabled={portal.isPending}
        onClick={() => portal.mutate()}
      >
        {portal.isPending ? "Opening billing…" : "Active — manage billing"}
      </Button>
    );
  }

  // A live Pass: say so, and when it ends, plainly. Buying again anyway is
  // allowed — a second Pass is a real use case a month from now.
  const passActive =
    purchase === "pass" &&
    access === "pass" &&
    passExpiresAt &&
    new Date(passExpiresAt).getTime() > Date.now();

  return (
    <div>
      <Button
        className="w-full py-3"
        disabled={checkout.isPending || accessQuery.isLoading}
        onClick={() => checkout.mutate({ purchase })}
      >
        {checkout.isPending
          ? "Opening checkout…"
          : purchase === "pass"
            ? `Get the ${PASS.name} — ${PASS.price}`
            : `Start ${GUARDIAN.name} — ${GUARDIAN.price}/year`}
      </Button>
      {passActive && (
        <p className="mt-2 text-center text-xs text-muted">
          Your Pass is active until {new Date(passExpiresAt!).toLocaleDateString()} — no need to
          buy again yet.
        </p>
      )}
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
