import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button, LinkButton } from "@/components/ui";
import { DetailMockup, HeroMockup } from "./landing-mockups";

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

const EVIDENCE = [
  {
    icon: "M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z",
    title: "Found, not estimated",
    body: "Every number comes from a real charge in a real email. Two matching charges at a regular interval confirm a subscription; a single sighting is shown as “possible” — never counted as spend.",
  },
  {
    icon: "M12 2l7 4v6c0 5-3 7.5-7 10-4-2.5-7-5-7-10V6l7-4z",
    title: "Process and discard",
    body: "Email bodies are parsed in memory and thrown away. We keep only the extracted facts — merchant, amount, date — and show you exactly which emails produced each subscription.",
  },
  {
    icon: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
    title: "Every subscription gets an exit",
    body: "Cancel link, phone number, or a ready-to-send cancellation email. And we tell you the truth: “request sent” is not “cancelled” until the provider confirms.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Connect your inbox",
    body: "Sign in with Google and grant read-only access to receipts. No bank linking, no passwords stored.",
  },
  {
    n: "2",
    title: "We scan for charges",
    body: "SubZero searches billing emails from known merchants and extracts merchant, amount, and date — nothing else.",
  },
  {
    n: "3",
    title: "Review what we found",
    body: "Confirmed subscriptions with evidence, possible ones flagged separately, and price changes highlighted.",
  },
  {
    n: "4",
    title: "Keep, cancel, or ignore",
    body: "Triage every subscription in one pass. For the ones you drop, we prepare the cancellation for you.",
  },
];

export default function LandingPage() {
  return (
    <main>
      {/* ===== Hero (always dark) ===== */}
      <section className="bg-[#0a1626] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#22b8d4]">
              Email-first subscription control
            </p>
            <h1 className="max-w-xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              Know what you’re paying for.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#a8b8ca]">
              SubZero finds recurring charges in your inbox, explains every subscription, and gives
              you a clear way out — without linking your bank.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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
              <a
                href="#how"
                className="rounded-lg border border-[#2a3d5c] px-6 py-3 text-base font-medium text-[#dbe6f2] transition-colors hover:border-[#22b8d4] hover:text-white"
              >
                How it works
              </a>
            </div>
            <p className="mt-6 text-sm text-[#64788f]">
              Read-only access · Revoke anytime · Works in any currency
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ===== Evidence ===== */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          Every number comes from real evidence
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted">
          No guessed budgets, no bank scraping. If SubZero shows a subscription, it can show you the
          emails that prove it.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {EVIDENCE.map((item) => (
            <div key={item.title} className="rounded-2xl border border-line bg-surface p-6">
              <span className="inline-flex rounded-lg bg-frost-soft p-2.5 text-frost">
                <Icon path={item.icon} />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">
            From inbox to clarity in four steps
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-frost text-sm font-bold text-frost-ink">
                  {step.n}
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Detail ===== */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Understand every charge</h2>
          <ul className="mt-6 space-y-4 text-muted">
            {[
              ["Charge timeline", "every receipt we found, in order, with the email it came from."],
              ["Price-change alerts", "when a merchant quietly raises the price, you see old vs. new."],
              ["Renewal warnings", "know what's about to charge you before it does."],
              ["An escape path", "cancel link, phone number, or a prepared cancellation email."],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1 text-frost">
                  <Icon path="M20 6L9 17l-5-5" className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-semibold text-ink">{title}</span> — {body}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <DetailMockup />
      </section>

      {/* ===== Privacy (dark) ===== */}
      <section className="bg-[#0a1626] text-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">
            Your inbox stays yours
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-8 text-center sm:grid-cols-3">
            {[
              ["Read-only access", "SubZero can never send, delete, or modify your email."],
              ["Nothing stored", "Bodies are processed in memory and discarded — only extracted facts are kept."],
              ["One-click revoke", "Disconnect anytime and optionally erase everything we derived."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="font-semibold text-[#22b8d4]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#a8b8ca]">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-[#64788f]">
            Full details in our{" "}
            <Link href="/privacy" className="text-[#22b8d4] underline-offset-2 hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ===== Pricing teaser ===== */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">
            Simple, honest pricing
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-bg p-6">
              <h3 className="font-semibold">Free scan</h3>
              <p className="tnum mt-1 text-3xl font-extrabold">$0</p>
              <p className="mt-2 text-sm text-muted">
                Your totals, how many subscriptions we found, and your most expensive one in full —
                evidence included.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-frost bg-bg p-6">
              <h3 className="font-semibold text-frost">Basic</h3>
              <p className="tnum mt-1 text-3xl font-extrabold">
                $4.99<span className="text-base font-medium text-muted">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                Every subscription unlocked · evidence and price history · cancellation drafts and
                tracking · monthly re-scan.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-bg p-6">
              <h3 className="font-semibold">Pro</h3>
              <p className="tnum mt-1 text-3xl font-extrabold">
                $9.99<span className="text-base font-medium text-muted">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                Unlimited inboxes · daily sync · renewal and price-increase alerts.
              </p>
            </div>
          </div>
          <p className="mt-8 text-center">
            <Link href="/pricing" className="font-medium text-frost hover:text-frost-strong">
              Compare plans in detail →
            </Link>
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Questions, answered</h2>
        <div className="mt-10 space-y-3">
          {[
            [
              "Can SubZero read all my email?",
              "It requests read-only access and searches only for billing emails from known merchants — receipts, invoices, renewal notices. It cannot send, delete, or modify anything, and you can revoke access in one click.",
            ],
            [
              "Do you store my emails?",
              "No. Email bodies are processed in memory and discarded. We keep only the extracted facts — merchant, amount, date, and the subject line that produced them — so you can always see the evidence.",
            ],
            [
              "Do I need to link my bank?",
              "Never. SubZero works entirely from email receipts, which is also why it works in any currency and with any bank.",
            ],
            [
              "What exactly is free?",
              "The scan itself, completely: we search 24 months of receipts and show you your per-currency monthly and yearly totals, how many subscriptions we found, and your single most expensive subscription in full detail with its evidence. The rest of the list, re-scans, and the cancellation tools unlock with Basic ($4.99/month).",
            ],
            [
              "Can SubZero cancel subscriptions for me?",
              "It gives every subscription an exit: a verified cancel link, a phone number, or a prepared cancellation email you send from your own address. We show “cancelled” only after the provider confirms — we don't pretend.",
            ],
            [
              "What happens if I delete my account?",
              "Inbox access is revoked and, on request, everything we derived — charges, subscriptions, evidence — is deleted. The privacy policy spells out the details.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="group rounded-xl border border-line bg-surface p-5">
              <summary className="cursor-pointer list-none font-semibold marker:content-none transition-colors duration-200 hover:text-frost">
                {q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight">
          Find out what you’re really paying for
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Free to start. The first scan usually takes under two minutes.
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
          <LinkButton variant="secondary" href="/pricing" className="px-6 py-3 text-base">
            See pricing
          </LinkButton>
        </div>
      </section>
    </main>
  );
}
