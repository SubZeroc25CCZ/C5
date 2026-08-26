import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { emailAccounts } from "@/db/schema";
import { encryptToken } from "@/lib/encryption";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth-state";
import { ANON_ACTOR, track } from "@/services/analytics";

/**
 * Why a consent flow died, as a small integer on `oauth_failed`. The event
 * value is the only payload analytics carries, so the cause has to be a
 * code — and knowing WHICH step loses people is the difference between
 * "Google's permission text scares them" and "our token exchange is broken".
 */
const OAUTH_FAILURE = {
  deniedOrForged: 1, // no code, or the CSRF nonce did not round-trip
  tokenExchange: 2,
  noRefreshToken: 3,
  gmailProfile: 4,
} as const;

function stateMatches(state: string | null, cookie: string | undefined): boolean {
  if (!state || !cookie) return false;
  const a = Buffer.from(state);
  const b = Buffer.from(cookie);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // The nonce set by /connect must round-trip: proves this browser started
  // the flow, so a crafted or replayed callback link is rejected.
  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!userId || !code || !stateMatches(state, stateCookie)) {
    await track(db, userId ?? ANON_ACTOR, "oauth_failed", OAUTH_FAILURE.deniedOrForged);
    return NextResponse.redirect(new URL("/dashboard?error=oauth", req.url));
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    await track(db, userId, "oauth_failed", OAUTH_FAILURE.tokenExchange);
    return NextResponse.redirect(new URL("/dashboard?error=oauth_exchange", req.url));
  }
  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
  };
  if (!tokens.refresh_token) {
    await track(db, userId, "oauth_failed", OAUTH_FAILURE.noRefreshToken);
    return NextResponse.redirect(new URL("/dashboard?error=no_refresh_token", req.url));
  }

  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) {
    await track(db, userId, "oauth_failed", OAUTH_FAILURE.gmailProfile);
    return NextResponse.redirect(new URL("/dashboard?error=gmail_profile", req.url));
  }
  const gmailProfile = (await profileResponse.json()) as { emailAddress: string };

  // The refresh token is encrypted with a per-user key before it touches
  // the database (§6) and is deleted the moment the user disconnects.
  await db
    .insert(emailAccounts)
    .values({
      userId,
      provider: "gmail",
      address: gmailProfile.emailAddress,
      encryptedRefreshToken: encryptToken(userId, tokens.refresh_token),
      status: "active",
    })
    .onConflictDoUpdate({
      target: [emailAccounts.userId, emailAccounts.address],
      set: {
        encryptedRefreshToken: encryptToken(userId, tokens.refresh_token),
        status: "active",
      },
    });

  await track(db, userId, "oauth_completed");
  await track(db, userId, "inbox_connected");

  const response = NextResponse.redirect(new URL("/dashboard?connected=1", req.url));
  response.cookies.delete(OAUTH_STATE_COOKIE); // single-use
  return response;
}
