import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentUser, isMasterAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
export default async function AdminPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login"); if (user.mustChangePassword) redirect("/change-password"); if (user.role !== "ADMIN") redirect("/");
  return <AppShell user={user}><AdminDashboard isMasterAdmin={isMasterAdmin(user)} embedded /></AppShell>;
}
