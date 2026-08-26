"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui";

/** The Pro card's action button: sign in → upgrade → manage, by state. */
export function ProAction() {
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
  if (planQuery.data?.plan === "pro") {
    return (
      <Button
        variant="secondary"
        className="w-full py-3"
        disabled={portal.isPending}
        onClick={() => portal.mutate()}
      >
        {portal.isPending ? "Opening billing…" : "Manage billing"}
      </Button>
    );
  }
  return (
    <div>
      <Button
        className="w-full py-3"
        disabled={checkout.isPending || planQuery.isLoading}
        onClick={() => checkout.mutate()}
      >
        {checkout.isPending ? "Opening checkout…" : "Upgrade to Pro"}
      </Button>
      {checkout.isError ? (
        <p className="mt-2 text-center text-xs text-danger">
          Checkout didn’t open — please try again.
        </p>
      ) : null}
    </div>
  );
}
