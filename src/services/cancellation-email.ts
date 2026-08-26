// Cancellation-email drafting service (carried from v1, renamed from
// "Cancel For Me" to "Prepare cancellation email", §8 P0). Drafts only —
// SubZero never sends on the user's behalf (read-only scope, §6), and the
// status ledger is explicit: draft → request_sent → provider_confirmed.
// "cancelled" in the UI always means "the user sent a request" until the
// provider confirms (§10.2).

export interface CancellationDraftInput {
  merchantName: string;
  userName: string;
  /** The email address the subscription is registered under. */
  accountEmail: string;
  /** Optional observed details that help support desks find the account. */
  amountFormatted?: string;
  cycle?: string;
  lastChargeDate?: string;
}

export interface CancellationDraft {
  subject: string;
  body: string;
}

export function draftCancellationEmail(input: CancellationDraftInput): CancellationDraft {
  const subject = `Cancellation request — account ${input.accountEmail}`;

  const details: string[] = [`- Account email: ${input.accountEmail}`];
  if (input.amountFormatted && input.cycle) {
    details.push(`- Plan: ${input.amountFormatted} billed ${input.cycle}`);
  }
  if (input.lastChargeDate) {
    details.push(`- Most recent charge: ${input.lastChargeDate}`);
  }

  const body = [
    `Hello ${input.merchantName} team,`,
    ``,
    `I would like to cancel my ${input.merchantName} subscription, effective immediately, and stop all future charges.`,
    ``,
    `Account details:`,
    ...details,
    ``,
    `Please confirm in writing that:`,
    `1. The subscription has been cancelled.`,
    `2. No further charges will be made.`,
    ``,
    `If you need any additional information to process this request, reply to this email.`,
    ``,
    `Thank you,`,
    `${input.userName}`,
  ].join("\n");

  return { subject, body };
}

export type CancellationStatus = "draft" | "request_sent" | "provider_confirmed";

const TRANSITIONS: Record<CancellationStatus, CancellationStatus[]> = {
  draft: ["request_sent"],
  request_sent: ["provider_confirmed"],
  provider_confirmed: [],
};

export function canTransition(from: CancellationStatus, to: CancellationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** UI copy that keeps the honesty rule (§10.2) in one place. */
export function statusLabel(status: CancellationStatus): string {
  switch (status) {
    case "draft":
      return "Draft — not sent yet";
    case "request_sent":
      return "Request sent — awaiting provider confirmation";
    case "provider_confirmed":
      return "Cancelled — confirmed by provider";
  }
}
