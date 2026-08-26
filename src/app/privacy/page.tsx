import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SubZero",
  description: "What SubZero accesses, what it keeps, what it discards, and how to delete it all.",
};

const UPDATED = "August 26, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {UPDATED}</p>
      <p className="mt-6 text-muted">
        SubZero (“we”, “us”) helps you find, understand, and cancel recurring subscriptions by
        reading billing emails in an inbox you connect. This policy describes exactly what we
        access, what we keep, what we throw away, and how you delete everything.
      </p>

      <Section title="The short version">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Read-only access.</strong> We can never send, delete, or modify your email.
          </li>
          <li>
            <strong>Process and discard.</strong> Email bodies are parsed in memory and discarded.
            We do not store the content of your emails.
          </li>
          <li>
            <strong>We keep only extracted facts:</strong> merchant name, amount, currency, charge
            date, and the email’s subject line and message reference — so every detected
            subscription can show its evidence.
          </li>
          <li>
            <strong>No bank linking, no selling data.</strong> We never connect to your bank and we
            never sell or share your data for advertising.
          </li>
          <li>
            <strong>One-click deletion.</strong> Disconnect your inbox anytime and optionally
            delete everything we derived from it.
          </li>
        </ul>
      </Section>

      <Section title="What we access">
        <p>
          When you connect a Google account, we request the <strong>read-only Gmail scope</strong>{" "}
          (<code>gmail.readonly</code>). We use it to run targeted searches for billing emails —
          receipts, invoices, and renewal notices from known subscription merchants — and to read
          the matching messages. We do not read your mailbox broadly, and the permission
          technically cannot send, delete, or alter anything.
        </p>
      </Section>

      <Section title="What we store — and what we don't">
        <p>
          From each billing email we extract and store: <strong>merchant, amount, currency, and
          charge date</strong>, plus the email’s <strong>subject line, sender, and message
          reference</strong> so you can always see which emails produced a detected subscription.
        </p>
        <p>
          <strong>We do not store email bodies.</strong> They are processed in memory during a scan
          and discarded. This is architectural, not a policy choice: our systems and staff cannot
          display content that was never persisted.
        </p>
        <p>
          We also store your account details (name, email address, sign-in identity), your
          connected inbox address and its encrypted access credential, your plan and billing
          status, and the subscriptions, price changes, and cancellation requests derived for you.
        </p>
      </Section>

      <Section title="AI processing">
        <p>
          Some billing emails from merchants we don’t yet recognize are analyzed by an AI model
          (Anthropic’s Claude, via API) solely to extract the merchant, amount, and date. The
          content sent for extraction is subject to the same process-and-discard rule, and it is
          not used to train AI models.
        </p>
      </Section>

      <Section title="Google user data — Limited Use disclosure">
        <p>
          SubZero’s use and transfer of information received from Google APIs adheres to the{" "}
          <a
            className="text-frost underline-offset-2 hover:underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically: Gmail data is used only to
          provide the subscription-detection features you see in the product; it is never used for
          advertising, never sold, never transferred except to provide those features (see
          subprocessors below), and never used to train generalized AI models. Humans do not read
          your Gmail data except with your explicit consent for support, where required for
          security or legal reasons, or in aggregated, anonymized form.
        </p>
      </Section>

      <Section title="Who processes data for us">
        <p>We use a small set of infrastructure providers, each only for what it says:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Vercel — application hosting</li>
          <li>Cloudflare — database hosting (extracted facts, never email bodies)</li>
          <li>Clerk — sign-in and account identity</li>
          <li>Google — OAuth and Gmail API access you grant</li>
          <li>Stripe — payments (we never see your card details)</li>
          <li>Anthropic — AI extraction of billing facts (no training on your data)</li>
        </ul>
      </Section>

      <Section title="Security">
        <p>
          Inbox credentials are encrypted at rest with per-user keys (AES-256-GCM); all traffic is
          encrypted in transit. OAuth tokens and encryption keys are never displayed in any
          interface, including our own admin tools.
        </p>
      </Section>

      <Section title="Retention and deletion">
        <p>
          Your data is kept while your account is active. You can{" "}
          <strong>disconnect an inbox at any time</strong> — the access credential is discarded
          immediately — and choose to also delete everything derived from it (charges,
          subscriptions, evidence, price history). Deleting your account removes all of the above.
          Revoking SubZero’s access from your Google Account settings has the same effect on
          access.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct, export, or delete
          your personal data. The product exposes the important ones directly (view evidence,
          disconnect, delete); for anything else, contact us and we’ll handle it.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes materially, we’ll note it here with a new date. Questions or
          requests: <strong>support@subzero.o2c.one</strong>.
        </p>
      </Section>
    </main>
  );
}
