import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// `/admin` is deliberately absent: `auth.protect()` would bounce an
// anonymous visitor to sign-in, which confirms the panel exists. The admin
// layout instead renders a 404 for anyone who is not a Super administrator —
// signed out or signed in — and every admin tRPC procedure re-checks. The
// panel's own API calls travel over /api/trpc, which is protected here.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/trpc(.*)", "/api/google(.*)"]);

// Without Clerk keys the middleware must not invoke Clerk at all — it would
// hard-500 every request (MIDDLEWARE_INVOCATION_FAILED). Pre-configuration,
// pass through; the layout serves a setup notice and protected pages are
// gated again once keys exist.
const clerkConfigured =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) await auth.protect();
    })
  : function passthrough() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    // `dev/preview` is the development-only design harness (404 in prod):
    // Clerk's dev-instance handshake redirect would break headless
    // screenshots of it, and it has no auth to protect.
    "/((?!_next|dev/preview|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
