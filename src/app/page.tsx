import { AppShell } from "@/components/app-shell";
import { OperationsDashboard } from "@/components/operations-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return <AppShell user={user}><OperationsDashboard user={user} /></AppShell>;
}
