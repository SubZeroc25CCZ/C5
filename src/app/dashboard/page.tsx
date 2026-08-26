import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { ensureUser } from "@/services/user";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  await ensureUser(db, {
    userId: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? "",
    displayName: user.fullName,
  });

  return <DashboardClient />;
}
