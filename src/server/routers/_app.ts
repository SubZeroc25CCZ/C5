import { router } from "../trpc";
import { subscriptionsRouter } from "./subscriptions";
import { reviewRouter } from "./review";
import { emailAccountsRouter } from "./email-accounts";
import { cancellationsRouter } from "./cancellations";
import { billingRouter } from "./billing";
import { researchRouter } from "./research";

export const appRouter = router({
  subscriptions: subscriptionsRouter,
  review: reviewRouter,
  emailAccounts: emailAccountsRouter,
  cancellations: cancellationsRouter,
  billing: billingRouter,
  research: researchRouter,
});

export type AppRouter = typeof appRouter;
