import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { currentUser } from "@clerk/nextjs/server";
import { protectedProcedure, router } from "../trpc";
import { profiles } from "@/db/schema";
import { createCheckoutSession, createPortalSession, stripeClient } from "@/services/stripe";

export const billingRouter = router({
  plan: protectedProcedure.query(async ({ ctx }) => {
    const profile = (
      await ctx.db.select().from(profiles).where(eq(profiles.userId, ctx.userId)).limit(1)
    )[0];
    return { plan: profile?.plan ?? "free" };
  }),

  checkout: protectedProcedure.mutation(async ({ ctx }) => {
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
