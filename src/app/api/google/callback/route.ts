import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { emailAccounts } from "@/db/schema";
import { encryptToken } from "@/lib/encryption";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth-state";

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
    return NextResponse.redirect(new URL("/dashboard?error=oauth_exchange", req.url));
  }
  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
  };
  if (!tokens.refresh_token) {
    return NextResponse.redirect(new URL("/dashboard?error=no_refresh_token", req.url));
  }

  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) {
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

  const response = NextResponse.redirect(new URL("/dashboard?connected=1", req.url));
  response.cookies.delete(OAUTH_STATE_COOKIE); // single-use
  return response;
}
