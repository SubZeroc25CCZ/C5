import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { CancellationsClient } from "./cancellations-client";

export const metadata: Metadata = {
  title: "Cancellation center — SubZero",
};

export default async function CancellationsPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  const dbConfigured = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_D1_DATABASE_ID &&
    process.env.CLOUDFLARE_API_TOKEN
  );
  if (!dbConfigured) redirect("/dashboard"); // dashboard renders the setup notice

  return (
    <CancellationsClient
      accountEmail={user.primaryEmailAddress?.emailAddress ?? ""}
    />
  );
}
