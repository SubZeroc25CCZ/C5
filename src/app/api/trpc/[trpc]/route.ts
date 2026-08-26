import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: ({ req: request }) => createContext({ req: request }),
    // Without this, a failing procedure returns a bare 500 and leaves no
    // trace in the platform logs — which is exactly how a Stripe
    // misconfiguration reached production looking like "please try again".
    // Expected client-side errors (auth, validation, a plan gate) are noise,
    // so only genuine server faults are logged.
    onError: ({ error, path, type }) => {
      if (error.code !== "INTERNAL_SERVER_ERROR") return;
      console.error(
        JSON.stringify({
          level: "error",
          message: "tRPC procedure failed",
          path: path ?? "<unknown>",
          type,
          error: error.cause instanceof Error ? error.cause.message : error.message,
        }),
      );
    },
  });

export { handler as GET, handler as POST };
