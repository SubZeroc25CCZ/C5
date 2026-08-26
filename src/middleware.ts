import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
