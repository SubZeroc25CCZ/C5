import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { emailAccounts, profiles } from "@/db/schema";
import { canConnectInbox, resolveAccess } from "@/lib/quota";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth-state";
import { track } from "@/services/analytics";

// Incremental consent (§8 P0): Gmail read-only is requested here, separately
// from sign-in, and ONLY gmail.readonly — never write/send (§6).

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/", req.url));

  const profile = (
    await db
      .select({ plan: profiles.plan, passExpiresAt: profiles.passExpiresAt })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1)
  )[0];
  const connected = await db
    .select({ id: emailAccounts.id })
    .from(emailAccounts)
    .where(and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active")));
  if (!canConnectInbox(resolveAccess(profile?.plan, profile?.passExpiresAt ?? null), connected.length)) {
    return NextResponse.redirect(new URL("/dashboard?error=inbox_quota", req.url));
  }

  // The consent screen is about to be shown: this is where OAuth genuinely
  // starts, and the pair (oauth_started, oauth_completed) measures how many
  // people Google's permission text turns away.
  await track(db, userId, "oauth_started");

  // CSRF protection: state is an unguessable nonce bound to this browser via
  // an httpOnly cookie, so a crafted callback link (someone else's code, or a
  // replay) can never attach an inbox to a session that didn't start the flow.
  const state = randomBytes(16).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return response;
}
