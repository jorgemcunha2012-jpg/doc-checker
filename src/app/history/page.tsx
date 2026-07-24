import { redirect } from "next/navigation";
import { ProcessHistory } from "@/components/process-history";
import { getCurrentUser, isMasterAdmin } from "@/lib/auth";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return <AppShell user={user}><div className="mx-auto max-w-7xl space-y-5"><div className="flex items-end justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-950">Histórico de conferências</h1><p className="mt-1 text-sm text-slate-500">{isMasterAdmin(user) ? "Todos os processos da equipe" : "Suas operações, documentos e resultados"}</p></div><Link href={{ pathname: "/validation" }} className="rounded-md bg-[#0faaa2] px-4 py-2 text-sm font-bold text-white">Nova conferência</Link></div><ProcessHistory showAnalyst={isMasterAdmin(user)} /></div></AppShell>;
}
