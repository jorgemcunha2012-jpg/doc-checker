import { redirect } from "next/navigation";
import { DevelopmentRegistry } from "@/components/development-registry";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function DevelopmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return <AppShell user={user}><DevelopmentRegistry canManage canDelete={user.role === "ADMIN"} /></AppShell>;
}
