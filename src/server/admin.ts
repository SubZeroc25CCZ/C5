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

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return adminUserIds().includes(userId);
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
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdmin(ctx.userId)) {
    // Deliberately NOT_FOUND-shaped in message: an admin panel should not
    // confirm its own existence to a signed-in customer probing for it.
    throw new TRPCError({ code: "FORBIDDEN", message: "Not found." });
  }
  return next({ ctx });
});
