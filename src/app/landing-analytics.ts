"use client";

import { trpc } from "@/lib/trpc";

// Landing-page instrumentation (conversion brief §11). Every call is
// fire-and-forget: a blocked or failed event must never delay a click on the
// primary CTA, which is the one thing this page exists to get right.

export type LandingEvent =
  | "landing_view"
  | "hero_cta_clicked"
  | "oauth_started"
  | "oauth_completed"
  | "oauth_failed"
  | "demo_step_viewed"
  | "pricing_viewed"
  | "faq_opened"
  | "final_cta_clicked"
  | "assistant_opened"
  | "assistant_message";

/** Events that should fire once per page view, however often they retrigger. */
const seen = new Set<string>();

export function useLandingEvents() {
  const report = trpc.research.landingEvent.useMutation();

  return {
    track(name: LandingEvent, value?: number) {
      report.mutate({ name, value });
    },
    /** For scroll- and open-triggered events that would otherwise repeat. */
    trackOnce(name: LandingEvent, value?: number) {
      const key = value === undefined ? name : `${name}:${value}`;
      if (seen.has(key)) return;
      seen.add(key);
      report.mutate({ name, value });
    },
  };
}
