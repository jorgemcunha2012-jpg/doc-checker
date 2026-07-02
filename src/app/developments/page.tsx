import { redirect } from "next/navigation";
import { DevelopmentRegistry } from "@/components/development-registry";
import { getCurrentUser } from "@/lib/auth";

export default async function DevelopmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "ADMIN") redirect("/");
  return <DevelopmentRegistry />;
}
