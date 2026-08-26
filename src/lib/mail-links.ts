// Send-path links for cancellation drafts (§2.8): the default path is the
// user's OWN mail client — merchants accept requests from the customer's
// address, and SubZero's Gmail scope is read-only, so it never sends.

export interface MailDraft {
  to?: string | null;
  subject: string;
  body: string;
}

export function mailtoHref({ to, subject, body }: MailDraft): string {
  const params = new URLSearchParams({ subject, body });
  // URLSearchParams encodes spaces as "+", which mail clients render
  // literally; percent-encode them instead.
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(to ?? "")}?${query}`;
}

/** Gmail web compose deep link — handy when no desktop mail app is set up. */
export function gmailComposeHref({ to, subject, body }: MailDraft): string {
  const params = new URLSearchParams({ view: "cm", su: subject, body });
  if (to) params.set("to", to);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
