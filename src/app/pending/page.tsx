import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProcessHistory } from "@/components/process-history";
import { getCurrentUser, isMasterAdmin } from "@/lib/auth";

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return <AppShell user={user}><div className="mx-auto max-w-7xl space-y-5"><div><h1 className="text-2xl font-bold text-slate-950">Pendências</h1><p className="mt-1 text-sm text-slate-500">Conferências que ainda exigem validação humana.</p></div><ProcessHistory showAnalyst={isMasterAdmin(user)} status="PENDING_REVIEW" /></div></AppShell>;
}
