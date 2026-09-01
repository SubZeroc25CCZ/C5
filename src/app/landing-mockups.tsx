// Landing-page visuals. Every figure here is FICTIONAL sample data — the
// merchants are invented ("Stream Plus", not Netflix) and the amounts are
// illustrative. Nothing in this file is read from, or represents, a real
// account. The brief is explicit: no real company names, no savings claims.
//
// Two rules learned the hard way govern this file:
//   1. Nothing may LOOK like a button unless it actually does something.
//      Earlier drafts drew "Connect" / "View evidence" pills inside the
//      mockups; visitors clicked them and nothing happened, which reads as
//      a broken site. Illustrations are illustrations — text and shapes.
//   2. The hero is a SCREENSHOT of the real dashboard (src/app/dev/preview
//      renders <DashboardClient> against a demo scan run through the real
//      matcher), captured at 2x density and CROPPED so the text is legible
//      at display size. Regenerate: dev server → screenshot
//      /dev/preview?access=guardian at 880px/2x, clip from the H1 to the
//      first row of cards, replace public/dashboard-demo.png. Never
//      hand-edit it, never widen the viewport (a full 1440px dashboard
//      shrunk into a 660px slot is unreadable — that was the old bug).

import Image from "next/image";
import dashboardDemo from "../../public/dashboard-demo.png";

/** Hero: a real dashboard screenshot (sample data) in a window frame. */
export function HeroMockup() {
  return (
    <figure className="lp-rise w-full">
      <div
        className="overflow-hidden"
        style={{
          borderRadius: "var(--lp-radius-panel)",
          border: "1px solid var(--lp-hairline)",
          boxShadow: "var(--lp-shadow-card)",
          background: "var(--lp-surface)",
        }}
      >
        {/* Window chrome: frames the image as "the app", not a poster. */}
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--lp-hairline)" }}
          aria-hidden
        >
          <span className="size-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
          <span className="size-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
          <span className="size-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
          <span
            className="ml-3 rounded-md px-2.5 py-0.5 text-[11px]"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--lp-text-muted)" }}
          >
            subzero.o2c.one/dashboard
          </span>
        </div>
        <Image
          src={dashboardDemo}
          alt="SubZero dashboard with sample data: a price-increase alert (Tune Box was $10.99, now $11.99), $41.97 per month across 3 active subscriptions ($503.64 per year), next renewal September 17, a connected inbox with re-scan, and subscription cards for Stream Plus at $17.99 and Tune Box at $11.99 per month."
          priority
          placeholder="blur"
          sizes="(min-width: 1024px) 620px, 100vw"
          className="h-auto w-full"
        />
      </div>
      <figcaption
        className="mt-2.5 text-center text-[11px] leading-snug"
        style={{ color: "var(--lp-text-muted)" }}
      >
        Real product screenshot — sample data from a demo scan.
      </figcaption>
    </figure>
  );
}

/** Section E — one subscription, expanded, showing its evidence. Pure illustration. */
export function EvidenceCard() {
  return (
    <div
      className="w-full p-6 sm:p-7"
      style={{
        borderRadius: "var(--lp-radius-panel)",
        background: "var(--lp-surface)",
        border: "1px solid var(--lp-hairline)",
        boxShadow: "var(--lp-shadow-card)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="lp-h3">Cloud Box</div>
          <div className="mt-1 text-sm" style={{ color: "var(--lp-text-muted)" }}>
            Charged every 30 days · next expected 03 Sep 2026
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
            $11.99
          </div>
          <span
            className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: "rgba(243,168,59,0.16)", color: "var(--lp-accent)" }}
          >
            up from $9.99
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--lp-text-muted)" }}>
            Last three receipts
          </div>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {["03 Aug 2026 — $11.99", "03 Jul 2026 — $9.99", "03 Jun 2026 — $9.99"].map((r) => (
              <li key={r} style={{ fontVariantNumeric: "tabular-nums", color: "var(--lp-text)" }}>
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--lp-text-muted)" }}>
            Why we think it recurs
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--lp-text-muted)" }}>
            Nine receipts from the same sender, each 30 days apart, each naming the same amount
            until August.
          </p>
        </div>
      </div>
    </div>
  );
}
