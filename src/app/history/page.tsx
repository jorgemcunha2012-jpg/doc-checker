import { redirect } from "next/navigation";
import { ProcessHistory } from "@/components/process-history";
import { getCurrentUser, isMasterAdmin } from "@/lib/auth";
import Link from "next/link";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div><h1 className="font-bold text-slate-950">Histórico de conferências</h1><p className="text-xs text-slate-500">{isMasterAdmin(user) ? "Todos os processos da equipe" : "Seus processos e documentos"}</p></div>
          <Link href="/" className="text-sm font-bold text-blue-600">Nova conferência</Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8"><ProcessHistory showAnalyst={isMasterAdmin(user)} /></div>
    </main>
  );
}
