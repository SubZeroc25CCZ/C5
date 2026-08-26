import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { emailAccounts, profiles } from "@/db/schema";
import { canConnectInbox } from "@/lib/quota";

// Incremental consent (§8 P0): Gmail read-only is requested here, separately
// from sign-in, and ONLY gmail.readonly — never write/send (§6).

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/", req.url));

  const profile = (
    await db.select({ plan: profiles.plan }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  )[0];
  const connected = await db
    .select({ id: emailAccounts.id })
    .from(emailAccounts)
    .where(and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active")));
  if (!canConnectInbox(profile?.plan ?? "free", connected.length)) {
    return NextResponse.redirect(new URL("/dashboard?error=inbox_quota", req.url));
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: userId,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
