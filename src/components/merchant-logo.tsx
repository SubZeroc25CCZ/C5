"use client";

import { useState } from "react";

/**
 * Merchant logo via the favicon service, falling back to an initial tile —
 * including when the network request FAILS (ad blockers, offline, the
 * service itself). Self-hosting all 400+ logos is the eventual answer
 * (D10 B6); until then a broken-image icon must never reach a screen.
 */
export function MerchantLogo({
  name,
  domain,
  size = 36,
}: {
  name: string;
  domain?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (domain && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
        alt=""
        width={size}
        height={size}
        className="rounded-lg bg-surface-2 object-contain p-1"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-lg bg-frost-soft text-sm font-bold text-frost"
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
