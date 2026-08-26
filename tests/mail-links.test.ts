import { describe, expect, it } from "vitest";
import { gmailComposeHref, mailtoHref } from "@/lib/mail-links";
import { draftFollowUpEmail } from "@/services/cancellation-email";

describe("mailtoHref", () => {
  it("encodes subject and body, with %20 for spaces (not +)", () => {
    const href = mailtoHref({
      to: "support@example.com",
      subject: "Cancellation request — account a@b.c",
      body: "Hello team,\n\nPlease cancel.",
    });
    expect(href.startsWith("mailto:support%40example.com?")).toBe(true);
    expect(href).toContain("subject=Cancellation%20request");
    expect(href).toContain("body=Hello%20team%2C%0A%0APlease%20cancel.");
    expect(href).not.toContain("+");
  });

  it("leaves the recipient empty when unknown", () => {
    const href = mailtoHref({ to: null, subject: "s", body: "b" });
    expect(href.startsWith("mailto:?")).toBe(true);
  });
});

describe("gmailComposeHref", () => {
  it("builds a compose deep link with su/body and optional to", () => {
    const href = gmailComposeHref({ to: "x@y.z", subject: "Sub ject", body: "Body text" });
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe("https://mail.google.com/mail/");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe("x@y.z");
    expect(url.searchParams.get("su")).toBe("Sub ject");
    expect(url.searchParams.get("body")).toBe("Body text");
    // Gmail renders "+" literally — spaces must be %20-encoded.
    expect(href).not.toContain("+");
  });

  it("omits to when unknown", () => {
    const url = new URL(gmailComposeHref({ subject: "s", body: "b" }));
    expect(url.searchParams.has("to")).toBe(false);
  });
});

describe("draftFollowUpEmail", () => {
  it("references the original request date and repeats the ask", () => {
    const draft = draftFollowUpEmail({
      merchantName: "Stream Plus",
      accountEmail: "me@example.com",
      sentDate: "2026-08-01",
    });
    expect(draft.subject).toContain("Follow-up");
    expect(draft.subject).toContain("me@example.com");
    expect(draft.body).toContain("On 2026-08-01");
    expect(draft.body).toContain("no further charges");
    // A follow-up is still a cancellation request if the first was missed.
    expect(draft.body).toContain("treat this email as that request");
  });
});
