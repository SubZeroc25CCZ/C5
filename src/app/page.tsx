import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button, Card, LinkButton } from "@/components/ui";

const PRINCIPLES = [
  {
    icon: "🔍",
    title: "Found, not estimated",
    body: "Every number comes from a real charge in a real email. Two matching charges at a regular interval confirm a subscription; one charge is shown as “possible” — never counted as spend.",
  },
  {
    icon: "🔒",
    title: "Process and discard",
    body: "Email bodies are parsed in memory and thrown away. We keep only the extracted facts — merchant, amount, date — and show you exactly which emails produced each subscription.",
  },
  {
    icon: "🚪",
    title: "Every subscription gets an exit",
    body: "Cancel link, phone number, or a ready-to-send cancellation email. And we tell you the truth: “request sent” is not “cancelled” until the provider confirms.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <section className="py-20 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-frost">
          Email-first · No bank linking · Any currency
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Your subscriptions are hiding in your inbox.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          SubZero reads your email receipts — read-only, with your explicit consent — and shows
          every recurring subscription, what it really costs per month, and how to escape it.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <Button className="px-6 py-3 text-base">Scan my inbox — free</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button className="px-6 py-3 text-base">Open your dashboard</Button>
            </Link>
          </SignedIn>
          <LinkButton variant="secondary" href="#how" className="px-6 py-3 text-base">
            How it works
          </LinkButton>
        </div>
      </section>

      <section id="how" className="grid gap-4 sm:grid-cols-3">
        {PRINCIPLES.map((principle) => (
          <Card key={principle.title}>
            <div className="text-3xl">{principle.icon}</div>
            <h3 className="mt-3 text-lg font-semibold">{principle.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{principle.body}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
