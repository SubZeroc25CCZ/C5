import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "Welcome to Pro — SubZero",
};

// The plan flips to "pro" when Stripe's checkout.session.completed webhook
// lands — usually before this page renders, occasionally a few seconds after.
export default function CheckoutSuccessPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-frost-soft text-3xl">
        ❄️
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight">Everything is unlocked</h1>
      <p className="mt-3 text-muted">
        Thanks for upgrading. Your full subscription list, evidence, and cancellation tools are
        unlocked — if the dashboard still shows locked rows, give it a few seconds while the
        payment confirmation arrives.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/dashboard">
          <Button className="px-6 py-3 text-base">Go to dashboard</Button>
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted">
        A receipt is on its way to your email. Manage or cancel anytime from the pricing page.
      </p>
    </main>
  );
}
