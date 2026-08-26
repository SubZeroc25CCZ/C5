// Landing-page mockups. Every figure here is FICTIONAL sample data — the
// merchants are invented ("Stream Plus", not Netflix) and the amounts are
// illustrative. Nothing in this file is read from, or represents, a real
// account. The brief is explicit: no real company names, no savings claims.

function Row({
  name,
  meta,
  amount,
  cadence,
}: {
  name: string;
  meta: string;
  amount: string;
  cadence: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold" style={{ color: "var(--lp-text)" }}>
          {name}
        </div>
        <div className="truncate text-xs" style={{ color: "var(--lp-text-muted)" }}>
          {meta}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold" style={{ color: "var(--lp-text)", fontVariantNumeric: "tabular-nums" }}>
          {amount}
        </div>
        <div className="text-xs" style={{ color: "var(--lp-text-muted)" }}>
          {cadence}
        </div>
      </div>
    </div>
  );
}

/** Hero dashboard: totals, status counts, three subscriptions, one price rise. */
export function HeroMockup() {
  return (
    <div
      className="lp-rise w-full p-5 sm:p-6"
      style={{
        borderRadius: "var(--lp-radius-panel)",
        background: "var(--lp-surface)",
        border: "1px solid var(--lp-hairline)",
        boxShadow: "var(--lp-shadow-card)",
      }}
      role="img"
      aria-label="Sample SubZero dashboard: an estimated monthly total of $48.96 across four detected subscriptions, three listed with renewal dates, and one price increase from $9.99 to $11.99."
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--lp-text-muted)" }}>
          Recurring, per month
        </span>
        <span className="text-xs" style={{ color: "var(--lp-text-muted)" }}>
          from your receipts
        </span>
      </div>
      <div className="mt-1 text-4xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
        $48.96
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(47,196,147,0.14)", color: "var(--lp-success)" }}>
          3 active
        </span>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.07)", color: "var(--lp-text-muted)" }}>
          1 possible
        </span>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(243,168,59,0.16)", color: "var(--lp-accent)" }}>
          1 price change
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Row name="Stream Plus" meta="Renews 14 Sep" amount="$17.99" cadence="per month" />
        <Row name="Cloud Box" meta="Renews 03 Sep" amount="$11.99" cadence="per month" />
        <Row name="Design Pro" meta="Renews 21 Sep" amount="$14.99" cadence="per month" />
      </div>

      {/* Price alert — the ONE place amber is allowed. */}
      <div
        className="lp-pulse-once mt-3 rounded-xl p-3"
        style={{ background: "rgba(243,168,59,0.10)", border: "1px solid rgba(243,168,59,0.28)" }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--lp-accent)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          Price increased
        </div>
        <div className="mt-1 text-sm" style={{ color: "var(--lp-text)" }}>
          Cloud Box <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--lp-text-muted)", textDecoration: "line-through" }}>$9.99</span>
          {" → "}
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>$11.99</span>
        </div>
      </div>

      {/* Keep / Cancel / Ignore */}
      <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="text-xs" style={{ color: "var(--lp-text-muted)" }}>What do you want to do with Design Pro?</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <span className="rounded-lg py-2 text-center text-xs font-semibold" style={{ background: "rgba(47,196,147,0.16)", color: "var(--lp-success)" }}>Keep</span>
          <span className="rounded-lg py-2 text-center text-xs font-semibold" style={{ background: "rgba(230,91,104,0.16)", color: "var(--lp-danger)" }}>Cancel</span>
          <span className="rounded-lg py-2 text-center text-xs font-semibold" style={{ background: "rgba(255,255,255,0.07)", color: "var(--lp-text-muted)" }}>Ignore</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-snug" style={{ color: "var(--lp-text-muted)" }}>
        Sample data, shown for illustration.
      </p>
    </div>
  );
}

/** Step 1 — the consent screen, drawn generically (no Google branding). */
export function ConnectMock() {
  return (
    <div className="w-full p-6" style={{ borderRadius: "var(--lp-radius-card)", background: "var(--lp-surface)", border: "1px solid var(--lp-hairline)" }}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl" style={{ background: "rgba(46,158,255,0.14)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lp-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold">Connect your inbox</div>
          <div className="text-xs" style={{ color: "var(--lp-text-muted)" }}>SubZero is asking for access</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(47,196,147,0.10)", border: "1px solid rgba(47,196,147,0.25)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lp-success)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span className="text-xs font-semibold" style={{ color: "var(--lp-success)" }}>Read-only — SubZero can never send, delete or edit</span>
      </div>
      <div className="mt-4 flex gap-2">
        <span className="flex-1 rounded-lg py-2.5 text-center text-sm font-semibold" style={{ background: "var(--lp-primary)", color: "#04111f" }}>Connect</span>
        <span className="rounded-lg px-4 py-2.5 text-center text-sm" style={{ border: "1px solid var(--lp-hairline)", color: "var(--lp-text-muted)" }}>Cancel</span>
      </div>
    </div>
  );
}

/** Step 2 — receipts grouping into subscriptions. */
export function GroupingMock() {
  return (
    <div className="w-full p-6" style={{ borderRadius: "var(--lp-radius-card)", background: "var(--lp-surface)", border: "1px solid var(--lp-hairline)" }}>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="h-6 rounded" style={{ width: `${34 + ((i * 13) % 40)}px`, background: "rgba(255,255,255,0.07)" }} aria-hidden />
        ))}
      </div>
      <div className="my-4 flex items-center justify-center gap-2 text-xs font-semibold" style={{ color: "var(--lp-primary-bright)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
        grouped by merchant, amount and date
      </div>
      <div className="flex flex-col gap-2">
        <Row name="Stream Plus" meta="6 receipts · every 30 days" amount="$17.99" cadence="per month" />
        <Row name="Cloud Box" meta="9 receipts · every 30 days" amount="$11.99" cadence="per month" />
        <Row name="Design Pro" meta="4 receipts · every 30 days" amount="$14.99" cadence="per month" />
      </div>
    </div>
  );
}

/** Step 3 — the evidence timeline behind one subscription. */
export function TimelineMock() {
  return (
    <div className="w-full p-6" style={{ borderRadius: "var(--lp-radius-card)", background: "var(--lp-surface)", border: "1px solid var(--lp-hairline)" }}>
      <div className="text-sm font-semibold">Cloud Box</div>
      <div className="text-xs" style={{ color: "var(--lp-text-muted)" }}>9 receipts found · charged every 30 days</div>
      <ol className="mt-4 flex flex-col gap-3">
        {[
          { d: "03 Aug 2026", a: "$11.99", rise: true },
          { d: "03 Jul 2026", a: "$9.99", rise: false },
          { d: "03 Jun 2026", a: "$9.99", rise: false },
        ].map((c) => (
          <li key={c.d} className="flex items-center gap-3">
            <span className="size-2 shrink-0 rounded-full" style={{ background: c.rise ? "var(--lp-accent)" : "var(--lp-primary)" }} aria-hidden />
            <span className="flex-1 text-xs" style={{ color: "var(--lp-text-muted)" }}>{c.d}</span>
            <span className="text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums", color: c.rise ? "var(--lp-accent)" : "var(--lp-text)" }}>{c.a}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 text-xs font-semibold" style={{ color: "var(--lp-primary-bright)" }}>View the receipt behind each charge →</div>
    </div>
  );
}

/** Step 4 — the three actions and the cancellation drawer. */
export function ActionsMock() {
  return (
    <div className="w-full p-6" style={{ borderRadius: "var(--lp-radius-card)", background: "var(--lp-surface)", border: "1px solid var(--lp-hairline)" }}>
      <div className="grid grid-cols-3 gap-2">
        <span className="rounded-xl py-3 text-center text-sm font-semibold" style={{ background: "rgba(47,196,147,0.16)", color: "var(--lp-success)" }}>Keep</span>
        <span className="rounded-xl py-3 text-center text-sm font-semibold" style={{ background: "var(--lp-danger)", color: "#2a0207" }}>Cancel</span>
        <span className="rounded-xl py-3 text-center text-sm font-semibold" style={{ background: "rgba(255,255,255,0.07)", color: "var(--lp-text-muted)" }}>Ignore</span>
      </div>
      <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--lp-hairline)" }}>
        <div className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--lp-text-muted)" }}>Cancellation options</div>
        <div className="mt-3 flex flex-col gap-2">
          {["Direct cancellation link", "Phone number", "Prepared cancellation email"].map((o) => (
            <div key={o} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,255,255,0.04)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lp-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 18l6-6-6-6" />
              </svg>
              {o}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--lp-text-muted)" }}>
        Cancellation is complete only after provider confirmation.
      </p>
    </div>
  );
}

/** Section E — one subscription card, expanded, showing its evidence. */
export function EvidenceCard() {
  return (
    <div
      className="w-full p-6 sm:p-7"
      style={{ borderRadius: "var(--lp-radius-panel)", background: "var(--lp-surface)", border: "1px solid var(--lp-hairline)", boxShadow: "var(--lp-shadow-card)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="lp-h3">Cloud Box</div>
          <div className="mt-1 text-sm" style={{ color: "var(--lp-text-muted)" }}>Charged every 30 days · next expected 03 Sep 2026</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>$11.99</div>
          <span className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "rgba(243,168,59,0.16)", color: "var(--lp-accent)" }}>
            up from $9.99
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--lp-text-muted)" }}>Last three receipts</div>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {["03 Aug 2026 — $11.99", "03 Jul 2026 — $9.99", "03 Jun 2026 — $9.99"].map((r) => (
              <li key={r} style={{ fontVariantNumeric: "tabular-nums", color: "var(--lp-text)" }}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--lp-text-muted)" }}>Why we think it recurs</div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--lp-text-muted)" }}>
            Nine receipts from the same sender, each 30 days apart, each naming the same amount until August.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: "rgba(46,158,255,0.14)", color: "var(--lp-primary-bright)" }}>View evidence</span>
        <span className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ border: "1px solid var(--lp-hairline)", color: "var(--lp-text)" }}>Cancellation options</span>
      </div>
    </div>
  );
}
