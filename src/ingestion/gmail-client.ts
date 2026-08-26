// Thin Gmail REST client (read-only). Uses fetch directly — no googleapis
// dependency — and only ever calls messages.list/messages.get with the
// targeted queries from gmail-queries.ts (§5.1). Scope: gmail.readonly.

import type { EmailCandidate } from "./types";
import { MAX_MESSAGES_PER_SCAN } from "./gmail-queries";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Gmail token refresh failed: ${response.status}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

interface GmailMessageRef {
  id: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Gmail API ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Run the query set, dedupe message ids, cap at MAX_MESSAGES_PER_SCAN. */
export async function listCandidateIds(
  accessToken: string,
  queries: string[],
): Promise<string[]> {
  const ids = new Set<string>();
  for (const query of queries) {
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ q: query, maxResults: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await gmailFetch<{ messages?: GmailMessageRef[]; nextPageToken?: string }>(
        accessToken,
        `/messages?${params}`,
      );
      for (const message of page.messages ?? []) {
        ids.add(message.id);
        if (ids.size >= MAX_MESSAGES_PER_SCAN) return [...ids];
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  return [...ids];
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractBody(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType?.startsWith("text/") && part.body?.data) {
    const text = decodeBase64Url(part.body.data);
    return part.mimeType === "text/html" ? stripHtml(text) : text;
  }
  for (const child of part.parts ?? []) {
    const text = extractBody(child);
    if (text) return text;
  }
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetch one message and shape it into an in-memory candidate. */
export async function fetchCandidate(
  accessToken: string,
  messageId: string,
): Promise<EmailCandidate> {
  const message = await gmailFetch<GmailMessage>(
    accessToken,
    `/messages/${messageId}?format=full`,
  );
  const headers = message.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  return {
    messageId: message.id,
    from: header("From"),
    subject: header("Subject"),
    receivedAt: new Date(Number(message.internalDate ?? Date.now())),
    body: extractBody(message.payload),
  };
}
