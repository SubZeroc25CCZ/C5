"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Card, cx } from "@/components/ui";

// Beta research kit §1 — the post-scan micro-survey. Shown on the results
// screen after the total is revealed (the emotional peak), dismissible,
// never blocking, asked once per user. It is NOT a paywall and must never
// look like one: no price framing beyond the honest question, no gating.

type Accuracy = "all_of_them" | "mostly" | "missed_a_lot" | "found_forgotten";
type Willingness = "yes" | "maybe_later" | "too_expensive" | "diy";

const ACCURACY_OPTIONS: Array<{ value: Accuracy; label: string }> = [
  { value: "all_of_them", label: "Yes, that’s all of them" },
  { value: "mostly", label: "Mostly — a few are missing" },
  { value: "missed_a_lot", label: "It missed a lot" },
  { value: "found_forgotten", label: "It found things I’d forgotten" },
];

const WILLINGNESS_OPTIONS: Array<{ value: Willingness; label: string }> = [
  { value: "yes", label: "Yes, worth it" },
  { value: "maybe_later", label: "Maybe later" },
  { value: "too_expensive", label: "No — too expensive" },
  { value: "diy", label: "No — I’d rather do it myself" },
];

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200",
        selected
          ? "border-frost bg-frost-soft font-medium text-ink"
          : "border-line hover:border-frost",
      )}
    >
      {children}
    </button>
  );
}

export function PostScanSurvey() {
  const status = trpc.research.surveyStatus.useQuery();
  const planQuery = trpc.billing.plan.useQuery();
  const utils = trpc.useUtils();
  const submit = trpc.research.submitSurvey.useMutation({
    onSettled: () => utils.research.surveyStatus.invalidate(),
  });

  const [accuracy, setAccuracy] = useState<Accuracy | null>(null);
  const [missingText, setMissingText] = useState("");
  const [willingness, setWillingness] = useState<Willingness | null>(null);
  const [willingnessText, setWillingnessText] = useState("");
  const [done, setDone] = useState(false);

  // Never render for someone who already answered or dismissed.
  if (!status.data || status.data.answered) return null;

  // Q3 (§1) asks about the teaser boundary: "To see the full list, SubZero
  // is $4.99/month. Would you?" — a nonsense question for someone who
  // already pays and already sees the full list, and it would contaminate
  // the willingness signal. Accuracy and the gap question still matter for
  // every user, so paid plans get a two-question survey instead.
  const askPricing = planQuery.data?.plan === "teaser";

  if (done) {
    return (
      <Card className="mb-6 border-frost bg-frost-soft/40">
        <p className="text-sm">Thank you — that genuinely shapes what we build next.</p>
      </Card>
    );
  }

  const showGap = accuracy === "mostly" || accuracy === "missed_a_lot";
  const showWhyNot = askPricing && (willingness === "too_expensive" || willingness === "diy");

  function dismiss() {
    // Records the decline so we never ask again.
    submit.mutate({ accuracy: "dismissed" });
    setDone(false);
    setAccuracy(null);
  }

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">
            {askPricing ? "Two quick questions" : "One quick question"}
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            You’re in the beta — your answers decide what we fix first.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="cursor-pointer rounded-lg px-2 py-1 text-sm text-muted transition-colors duration-200 hover:text-ink"
          aria-label="Dismiss survey"
        >
          Not now
        </button>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">Does this list match what you expected?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ACCURACY_OPTIONS.map((option) => (
            <Choice
              key={option.value}
              selected={accuracy === option.value}
              onClick={() => setAccuracy(option.value)}
            >
              {option.label}
            </Choice>
          ))}
        </div>
      </div>

      {showGap && (
        <div className="mt-4">
          <label htmlFor="survey-missing" className="text-sm font-medium">
            Which subscriptions are missing?
          </label>
          <p className="text-xs text-muted">
            Optional — but every name here is one we teach SubZero to find.
          </p>
          <input
            id="survey-missing"
            value={missingText}
            onChange={(event) => setMissingText(event.target.value)}
            placeholder="e.g. my gym, a local news site…"
            className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
        </div>
      )}

      {accuracy && askPricing && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            To see the full list, SubZero is $4.99/month. Would you?
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {WILLINGNESS_OPTIONS.map((option) => (
              <Choice
                key={option.value}
                selected={willingness === option.value}
                onClick={() => setWillingness(option.value)}
              >
                {option.label}
              </Choice>
            ))}
          </div>
        </div>
      )}

      {showWhyNot && (
        <div className="mt-4">
          <label htmlFor="survey-why" className="text-sm font-medium">
            What would make it worth paying for?
          </label>
          <input
            id="survey-why"
            value={willingnessText}
            onChange={(event) => setWillingnessText(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
        </div>
      )}

      {accuracy && (
        <div className="mt-4 flex items-center gap-3">
          <Button
            disabled={submit.isPending}
            onClick={() => {
              submit.mutate({
                accuracy,
                missingText: showGap ? missingText : undefined,
                // Paid plans are never asked Q3, so their willingness stays
                // "unanswered" rather than a value we didn't collect.
                willingness: askPricing ? willingness ?? "unanswered" : "unanswered",
                willingnessText: showWhyNot ? willingnessText : undefined,
              });
              setDone(true);
            }}
          >
            {submit.isPending ? "Sending…" : "Send"}
          </Button>
          <span className="text-xs text-muted">Takes a second. Never blocks anything.</span>
        </div>
      )}
    </Card>
  );
}
