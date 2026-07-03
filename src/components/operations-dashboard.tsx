"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileCheck2, Loader2, Plus, Timer } from "lucide-react";
import Link from "next/link";
import type { User } from "@/domain/validation";

type DashboardProcess = {
  id: string;
  processing_status: string;
  final_status: string;
  started_at: string;
  completed_at: string | null;
  profiles: { name: string } | null;
  process_documents: Array<{ id: string; name: string }>;
};

export function OperationsDashboard({ user }: { user: User }) {
  const [processes, setProcesses] = useState<DashboardProcess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/processes")
      .then((response) => response.json())
      .then((payload) => setProcesses(payload.processes ?? []))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const finished = processes.filter((process) => process.final_status !== "IN_PROGRESS" && process.final_status !== "FAILED");
    const checked = processes.filter((process) => process.final_status === "FULLY_CHECKED").length;
    const durations = finished.flatMap((process) => process.completed_at ? [new Date(process.completed_at).getTime() - new Date(process.started_at).getTime()] : []);
    return {
      active: processes.filter((process) => process.final_status === "IN_PROGRESS").length,
      documents: finished.reduce((total, process) => total + process.process_documents.length, 0),
      pending: processes.filter((process) => process.final_status === "PENDING_REVIEW").length,
      approval: finished.length ? Math.round((checked / finished.length) * 100) : 0,
      averageMs: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0,
    };
  }, [processes]);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Olá, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-slate-500">Acompanhe suas conferências e pendências documentais.</p>
        </div>
        <Link href={{ pathname: "/validation" }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#0faaa2] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0c8f89]">
          <Plus className="h-4 w-4" /> Nova conferência
        </Link>
      </section>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#0faaa2]" /></div> : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Clock3} label="Operações ativas" value={metrics.active} tone="teal" />
            <Metric icon={FileCheck2} label="Documentos analisados" value={metrics.documents} tone="violet" />
            <Metric icon={AlertCircle} label="Pendências abertas" value={metrics.pending} tone="amber" />
            <Metric icon={CheckCircle2} label="Taxa de conferência" value={`${metrics.approval}%`} tone="green" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
            <div className="border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div><h2 className="font-bold text-slate-950">Últimas conferências</h2><p className="mt-1 text-xs text-slate-500">Processos mais recentes</p></div>
                <Link href={{ pathname: "/history" }} className="text-xs font-bold text-[#0f8f88]">Ver histórico</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {processes.slice(0, 6).map((process) => (
                  <div key={process.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_180px_130px] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-800">{process.process_documents.map((document) => document.name).join(", ") || "Sem documentos"}</div>
                      <div className="mt-1 text-xs text-slate-500">{user.role === "ADMIN" ? `${process.profiles?.name ?? "Analista"} · ` : ""}{new Date(process.started_at).toLocaleString("pt-BR")}</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">{process.process_documents.length} documento(s)</div>
                    <Status value={process.final_status} />
                  </div>
                ))}
                {!processes.length ? <div className="py-12 text-center text-sm text-slate-500">Nenhuma conferência realizada.</div> : null}
              </div>
            </div>
            <div className="border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2"><Timer className="h-5 w-5 text-[#0faaa2]" /><h2 className="font-bold text-slate-950">Eficiência</h2></div>
              <div className="mt-8 text-4xl font-bold text-slate-950">{formatDuration(metrics.averageMs)}</div>
              <div className="mt-2 text-sm text-slate-500">Tempo médio por conferência</div>
              <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-3/4 rounded-full bg-[#0faaa2]" /></div>
              <p className="mt-4 text-xs leading-5 text-slate-500">Calculado com base nos processos concluídos disponíveis no histórico.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number | string; tone: "teal" | "violet" | "amber" | "green" }) {
  const tones = { teal: "bg-teal-50 text-teal-600", violet: "bg-violet-50 text-violet-600", amber: "bg-amber-50 text-amber-600", green: "bg-emerald-50 text-emerald-600" };
  return <div className="border border-slate-200 bg-white p-5"><div className={`flex h-10 w-10 items-center justify-center rounded-full ${tones[tone]}`}><Icon className="h-5 w-5" /></div><div className="mt-4 text-sm font-semibold text-slate-500">{label}</div><div className="mt-1 text-3xl font-bold text-slate-950">{value}</div></div>;
}

function Status({ value }: { value: string }) {
  const copy = ({ IN_PROGRESS: "Em análise", PENDING_REVIEW: "Com pendências", FULLY_CHECKED: "Conferido", FAILED: "Falhou" } as Record<string, string>)[value] ?? value;
  const tone = ({ IN_PROGRESS: "bg-blue-50 text-blue-700", PENDING_REVIEW: "bg-amber-50 text-amber-700", FULLY_CHECKED: "bg-emerald-50 text-emerald-700", FAILED: "bg-rose-50 text-rose-700" } as Record<string, string>)[value] ?? "bg-slate-100 text-slate-600";
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{copy}</span>;
}

function formatDuration(milliseconds: number) {
  if (!milliseconds) return "Sem dados";
  const minutes = Math.round(milliseconds / 60_000);
  return minutes < 1 ? "< 1 min" : `${minutes} min`;
}
