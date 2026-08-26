import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

export default function LandingPage() {
  return (
    <main>
      <section style={{ textAlign: "center", padding: "3rem 0 2rem" }}>
        <h1 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>
          Your subscriptions are hiding in your inbox.
        </h1>
        <p className="muted" style={{ maxWidth: 560, margin: "0 auto 1.5rem" }}>
          SubZero reads your email receipts — read-only, with your explicit consent — and shows
          every recurring subscription, what it really costs per month, and how to escape it. No
          bank linking. Works in any country, any currency.
        </p>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="primary">Sign in with Google to scan your inbox</button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard">
            <button className="primary">Open your dashboard</button>
          </Link>
        </SignedIn>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        <div className="card">
          <h3>Found, not estimated</h3>
          <p className="muted">
            Every number comes from a real charge in a real email. Two matching charges at a
            regular interval confirm a subscription; one charge is shown as &ldquo;possible&rdquo; —
            never counted as spend.
          </p>
        </div>
        <div className="card">
          <h3>Process and discard</h3>
          <p className="muted">
            Email bodies are parsed in memory and thrown away. We keep only the extracted facts —
            merchant, amount, date — and show you exactly which emails produced each subscription.
          </p>
        </div>
        <div className="card">
          <h3>Every subscription gets an exit</h3>
          <p className="muted">
            Cancel link, phone number, or a ready-to-send cancellation email. And we tell you the
            truth: &ldquo;request sent&rdquo; is not &ldquo;cancelled&rdquo; until the provider
            confirms.
          </p>
        </div>
      </section>
    </main>
  );
}
