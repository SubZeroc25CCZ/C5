import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { SubscriptionDetailClient } from "./detail-client";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId)) redirect("/dashboard");
  return <SubscriptionDetailClient id={numericId} />;
}
