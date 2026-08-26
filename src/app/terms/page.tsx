import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — SubZero",
  description: "The terms that govern your use of SubZero.",
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

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {UPDATED}</p>
      <p className="mt-6 text-muted">
        These terms govern your use of SubZero. By creating an account or using the service, you
        agree to them. The plain-English summaries are part of the terms, not decoration.
      </p>

      <Section title="What SubZero is">
        <p>
          SubZero detects recurring subscriptions by reading billing emails in inboxes you
          explicitly connect, shows you what they cost, and helps you cancel the ones you don’t
          want. Access is read-only and revocable at any time. How we handle data is described in
          the <a className="text-frost underline-offset-2 hover:underline" href="/privacy">Privacy Policy</a>, which is part of these terms.
        </p>
      </Section>

      <Section title="What SubZero is not">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Not exhaustive.</strong> We detect subscriptions from the emails we can find.
            A subscription that never emailed the connected inbox won’t appear. Detected amounts
            and renewal dates come from observed charges; “expected” renewals are estimates.
          </li>
          <li>
            <strong>Not a cancellation guarantee.</strong> We prepare cancellation requests —
            links, phone numbers, drafted emails — but the provider decides. We show a
            subscription as cancelled only when there is confirmation, and until then we say so.
          </li>
          <li>
            <strong>Not financial advice.</strong> SubZero reports what it observed; decisions are
            yours.
          </li>
        </ul>
      </Section>

      <Section title="Your account">
        <p>
          You must be able to form a binding contract and connect only inboxes you own or are
          authorized to connect. Keep your sign-in secure; you are responsible for activity under
          your account.
        </p>
      </Section>

      <Section title="Plans and billing">
        <p>
          The Free plan is free. Pro is a paid monthly subscription billed by Stripe; the current
          price is shown at checkout. You can cancel anytime from the billing portal — cancellation
          takes effect at the end of the paid period, and we don’t do dark patterns: cancelling
          SubZero is at least as easy as anything SubZero helps you cancel. Prices may change with
          notice before your next renewal.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Don’t abuse the service: no attempts to access other users’ data, probe or overload the
          systems, resell the service, or use it for anything unlawful. We may suspend accounts
          that do.
        </p>
      </Section>

      <Section title="Disclaimers and liability">
        <p>
          The service is provided “as is” without warranties of any kind. To the maximum extent
          permitted by law, our total liability for any claim related to the service is limited to
          the amount you paid us in the twelve months before the claim. Nothing in these terms
          limits liability that cannot lawfully be limited.
        </p>
      </Section>

      <Section title="Ending things">
        <p>
          You can stop using SubZero, disconnect inboxes, and delete your account at any time. We
          may terminate or suspend the service for breach of these terms or discontinue the service
          with reasonable notice, in which case data deletion follows the Privacy Policy.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If these terms change materially, we’ll note it here with a new date and, where
          appropriate, notify you in the product. Questions:{" "}
          <strong>support@subzero.o2c.one</strong>.
        </p>
      </Section>
    </main>
  );
}
