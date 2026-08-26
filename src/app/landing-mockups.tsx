// Product mockups for the landing page. All merchants and amounts are
// fictional sample data — nothing here implies real user data. Colors are
// fixed (not theme tokens) because the mockups sit on the always-dark hero.

// Colorblind-safe categorical palette (validated, dark surface).
const DONUT = [
  { name: "Stream Plus", amount: "€14.99", color: "#3987e5", pct: 34 },
  { name: "Design Pro", amount: "€24.00", color: "#d95926", pct: 26 },
  { name: "Cloud Box", amount: "€9.99", color: "#199e70", pct: 18 },
  { name: "Daily Read", amount: "€7.50", color: "#c98500", pct: 13 },
  { name: "3 more", amount: "€17.48", color: "#d55181", pct: 9 },
];

function Donut() {
  const r = 34;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="120" height="120" viewBox="0 0 96 96" aria-hidden>
      {DONUT.map((seg) => {
        const dash = (seg.pct / 100) * c;
        const el = (
          <circle
            key={seg.name}
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeDasharray={`${Math.max(dash - 2, 1)} ${c - dash + 2}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 48 48)"
          />
        );
        offset += dash;
        return el;
      })}
      <text
        x="48"
        y="45"
        textAnchor="middle"
        fill="#e8eef6"
        fontSize="13"
        fontWeight="700"
        className="tnum"
      >
        €184.70
      </text>
      <text x="48" y="58" textAnchor="middle" fill="#8ba0b8" fontSize="8">
        per month
      </text>
    </svg>
  );
}

const RENEWALS = [
  { name: "Stream Plus", days: "3 days", width: "22%" },
  { name: "Cloud Box", days: "9 days", width: "48%" },
  { name: "Design Pro", days: "17 days", width: "78%" },
];

export function HeroMockup() {
  return (
    <div className="w-full max-w-xl rounded-2xl border border-[#1c2c44] bg-[#0e1a2e] shadow-2xl shadow-black/40">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-[#1c2c44] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#2a3d5c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#2a3d5c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#2a3d5c]" />
        <span className="ml-3 text-xs text-[#64788f]">subzero.o2c.one/dashboard</span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-[auto_1fr]">
        {/* spend donut */}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-[#1c2c44] bg-[#101f36] p-4">
          <Donut />
          <div className="space-y-1 text-[11px]">
            {DONUT.slice(0, 3).map((seg) => (
              <div key={seg.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm" style={{ background: seg.color }} />
                <span className="text-[#b7c5d6]">{seg.name}</span>
                <span className="tnum ml-auto text-[#e8eef6]">{seg.amount}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {/* stat row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["7", "active"],
              ["2", "possible"],
              ["1", "price rise"],
            ].map(([n, label]) => (
              <div key={label} className="rounded-lg border border-[#1c2c44] bg-[#101f36] px-2 py-2.5">
                <div className="tnum text-lg font-bold text-white">{n}</div>
                <div className="text-[10px] uppercase tracking-wide text-[#64788f]">{label}</div>
              </div>
            ))}
          </div>
          {/* renewing soon */}
          <div className="rounded-xl border border-[#1c2c44] bg-[#101f36] p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#64788f]">
              Renewing soon
            </div>
            <div className="space-y-2.5">
              {RENEWALS.map((row) => (
                <div key={row.name} className="flex items-center gap-3 text-xs">
                  <span className="w-20 shrink-0 text-[#dbe6f2]">{row.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1c2c44]">
                    <div
                      className="h-full rounded-full bg-[#22b8d4]"
                      style={{ width: row.width }}
                    />
                  </div>
                  <span className="tnum w-12 shrink-0 text-right text-[#8ba0b8]">{row.days}</span>
                </div>
              ))}
            </div>
          </div>
          {/* evidence chip */}
          <div className="flex items-start gap-2.5 rounded-xl border border-[#1c2c44] bg-[#101f36] p-3.5 text-xs">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22b8d4"
              strokeWidth="2"
              strokeLinecap="round"
              className="mt-0.5 shrink-0"
              aria-hidden
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            <div>
              <span className="text-[#dbe6f2]">
                Stream Plus — €14.99 · confirmed by <span className="text-white">3 receipts</span>
              </span>
              <div className="mt-0.5 text-[#64788f]">
                “Your Stream Plus receipt” · Jun 12 · Jul 12 · Aug 12
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailMockup() {
  return (
    <div className="w-full rounded-2xl border border-line bg-surface p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Stream Plus</div>
          <div className="text-xs text-muted">Monthly · next renewal Sep 12</div>
        </div>
        <div className="tnum text-lg font-bold">€14.99</div>
      </div>
      <div className="mt-4 space-y-2">
        {[
          ["Aug 12", "€14.99", "receipt"],
          ["Jul 12", "€14.99", "receipt"],
          ["Jun 12", "€12.99", "price change"],
        ].map(([date, amount, kind]) => (
          <div
            key={date}
            className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs"
          >
            <span className="text-muted">{date}</span>
            <span
              className={
                kind === "price change" ? "font-medium text-warn" : "text-muted"
              }
            >
              {kind}
            </span>
            <span className="tnum font-semibold">{amount}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-frost/30 bg-frost-soft px-3 py-2.5 text-xs">
        <span className="font-semibold text-frost">Escape path:</span>{" "}
        <span className="text-ink">cancel online, or prepare a cancellation email — ready to send.</span>
      </div>
    </div>
  );
}
