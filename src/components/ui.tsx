import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

// SubZero UI kit — small, dependency-free primitives styled with Tailwind.

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const buttonVariants = {
  primary:
    "bg-frost text-frost-ink hover:bg-frost-strong shadow-sm font-semibold",
  secondary:
    "border border-frost text-frost hover:bg-frost-soft font-medium",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  danger: "border border-danger text-danger hover:bg-danger-bg font-medium",
} as const;

type ButtonVariant = keyof typeof buttonVariants;

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-frost",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant }) {
  return (
    <a
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors duration-200 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-frost",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const badgeVariants = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  muted: "bg-surface-2 text-muted",
  frost: "bg-frost-soft text-frost",
} as const;

export function Badge({
  variant = "muted",
  children,
  className,
}: {
  variant?: keyof typeof badgeVariants;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        badgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Status → badge mapping with honest labels (§10.2). */
export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <Badge variant="ok">active</Badge>;
    case "possible":
      return <Badge variant="warn">seen once</Badge>;
    case "needs_review":
      return <Badge variant="warn">needs review</Badge>;
    case "cancellation_requested":
      return <Badge variant="frost">request sent</Badge>;
    case "cancelled":
      return <Badge variant="muted">cancelled ✓</Badge>;
    case "ignored":
      return <Badge variant="muted">ignored</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card className="flex-1 min-w-44">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="tnum mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

/** Merchant logo via favicon service, falling back to an initial tile. */
export function MerchantLogo({
  name,
  domain,
  size = 36,
}: {
  name: string;
  domain?: string | null;
  size?: number;
}) {
  if (domain) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
        alt=""
        width={size}
        height={size}
        className="rounded-lg bg-surface-2 object-contain p-1"
        loading="lazy"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-lg bg-frost-soft text-sm font-bold text-frost"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Cancellation difficulty, 1 (easy) – 5 (hostile). */
export function DifficultyMeter({ level }: { level: number }) {
  const clamped = Math.min(5, Math.max(1, level));
  return (
    <span className="inline-flex items-center gap-1" title={`Cancellation difficulty ${clamped}/5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={cx(
            "h-2 w-2 rounded-full",
            step <= clamped
              ? clamped >= 4
                ? "bg-danger"
                : clamped >= 3
                  ? "bg-warn"
                  : "bg-ok"
              : "bg-line",
          )}
        />
      ))}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="py-12 text-center">
      {icon && <div className="mb-2 text-4xl">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
    </Card>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full bg-frost transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
