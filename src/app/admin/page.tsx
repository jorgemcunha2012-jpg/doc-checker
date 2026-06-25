import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentUser } from "@/lib/auth";
export default async function AdminPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login"); if (user.mustChangePassword) redirect("/change-password"); if (user.role !== "ADMIN") redirect("/");
  return <AdminDashboard />;
}
