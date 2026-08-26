// Admin access control (§4, §5, §6). At P0 the only administrator is the
// founder — a Super administrator — identified by Clerk id in the
// ADMIN_USER_IDS environment variable. The role matrix in §5 arrives with
// P1; until then every admin procedure requires Super.
//
// Two product laws are enforced here rather than promised:
//   • Rule 3 — every admin action writes to the immutable audit log BEFORE
//     it completes. `audit()` is awaited first in each mutation.
//   • Rules 1 & 2 — nothing in this layer can reach an email body (they are
//     discarded at processing time) or an OAuth token (encrypted, never
//     selected by any admin query).

import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { adminAuditLog } from "@/db/schema";
import { protectedProcedure } from "./trpc";

/** Super administrators, from the environment. Empty means: no admins. */
export function adminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Super administrators by VERIFIED email, from the environment. Clerk does
 * not guarantee one identity per person — a new sign-in method mints a new
 * user id (it did, twice, on launch day), and an id-only allowlist silently
 * locks the founder out each time. An email survives identity churn.
 *
 * Still an environment variable, and still matched against Clerk's own
 * verified-email records — never the local users table — so an attacker
 * with database write access cannot promote themselves, and an unverified
 * address someone merely typed into their Clerk profile counts for nothing.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// One Clerk lookup per admin candidate per few minutes, not per request.
// Only consulted after the id list missed, so customers never trigger it
// unless ADMIN_EMAILS is configured at all.
const emailVerdicts = new Map<string, { admin: boolean; at: number }>();
const EMAIL_VERDICT_TTL_MS = 5 * 60_000;

export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  if (adminUserIds().includes(userId)) return true;

  const emails = adminEmails();
  if (emails.length === 0) return false;

  const cached = emailVerdicts.get(userId);
  if (cached && Date.now() - cached.at < EMAIL_VERDICT_TTL_MS) return cached.admin;

  try {
    // Imported lazily: this path needs Clerk's backend API, which only
    // exists when ADMIN_EMAILS is in use and the id check already missed.
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const admin = user.emailAddresses.some(
      (entry) =>
        entry.verification?.status === "verified" &&
        emails.includes(entry.emailAddress.toLowerCase()),
    );
    emailVerdicts.set(userId, { admin, at: Date.now() });
    return admin;
  } catch {
    // Clerk unreachable → fail closed. Better a locked-out founder than an
    // open panel.
    return false;
  }
}

/**
 * Append to the immutable audit log. Unlike `track()` in analytics, this
 * deliberately does NOT swallow failures: rule 3 says the log is written
 * before the action completes, so a failed write must abort the action
 * rather than let it proceed unrecorded.
 */
export async function audit(
  db: Database,
  actorUserId: string,
  action: string,
  fields: { target?: string; detail?: string; ip?: string } = {},
): Promise<void> {
  await db.insert(adminAuditLog).values({
    actorUserId,
    action,
    target: fields.target ?? null,
    detail: fields.detail ?? null,
    ip: fields.ip ?? null,
  });
}

/** How long one admin sitting counts as the same session, for the log. */
const SESSION_WINDOW_MS = 30 * 60_000;

/**
 * Record an admin session (§4.12: "every admin sign-in"). A page view is not
 * a sign-in, and the panel's layout re-renders on every navigation, so this
 * collapses a continuous sitting into one row — an audit log nobody can read
 * because it is 90% navigation noise protects nothing.
 */
export async function auditSession(db: Database, actorUserId: string): Promise<void> {
  const recent = (
    await db
      .select({ createdAt: adminAuditLog.createdAt })
      .from(adminAuditLog)
      .where(and(eq(adminAuditLog.actorUserId, actorUserId), eq(adminAuditLog.action, "admin.session")))
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(1)
  )[0];
  if (recent && Date.now() - recent.createdAt.getTime() < SESSION_WINDOW_MS) return;
  await audit(db, actorUserId, "admin.session", { detail: "opened the admin panel" });
}

/** Every admin procedure: authenticated AND on the Super administrator list. */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await isAdmin(ctx.userId))) {
    // Deliberately NOT_FOUND-shaped in message: an admin panel should not
    // confirm its own existence to a signed-in customer probing for it.
    throw new TRPCError({ code: "FORBIDDEN", message: "Not found." });
  }
  return next({ ctx });
});
