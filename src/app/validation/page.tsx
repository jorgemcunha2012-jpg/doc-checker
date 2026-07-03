import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConferiaWorkspace } from "@/components/conferia-workspace";
import { getCurrentUser } from "@/lib/auth";

export default async function ValidationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return <AppShell user={user}><ConferiaWorkspace currentUser={user} embedded /></AppShell>;
}
