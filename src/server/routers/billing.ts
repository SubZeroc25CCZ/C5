import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { currentUser } from "@clerk/nextjs/server";
import { protectedProcedure, router } from "../trpc";
import { profiles } from "@/db/schema";
import { userAccessState } from "../plan";
import { createCheckoutSession, createPortalSession, stripeClient } from "@/services/stripe";

export const billingRouter = router({
  /** Effective access + pass expiry, for every gated surface. */
  plan: protectedProcedure.query(async ({ ctx }) => {
    return userAccessState(ctx.db, ctx.userId);
  }),

  checkout: protectedProcedure
    .input(z.object({ purchase: z.enum(["pass", "guardian"]) }))
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();
      const email = user?.primaryEmailAddress?.emailAddress;
      if (!email) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No email on account." });
      const profile = (
        await ctx.db.select().from(profiles).where(eq(profiles.userId, ctx.userId)).limit(1)
      )[0];
      const url = await createCheckoutSession(stripeClient(), {
        userId: ctx.userId,
        email,
        customerId: profile?.stripeCustomerId,
        purchase: input.purchase,
      });
      return { url };
    }),

  portal: protectedProcedure.mutation(async ({ ctx }) => {
    const profile = (
      await ctx.db.select().from(profiles).where(eq(profiles.userId, ctx.userId)).limit(1)
    )[0];
    if (!profile?.stripeCustomerId) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No billing account yet." });
    }
    const url = await createPortalSession(stripeClient(), profile.stripeCustomerId);
    return { url };
  }),
});
