"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileCheck2, Plus, Timer } from "lucide-react";
import Link from "next/link";
import type { User } from "@/domain/validation";
import { processCode } from "@/lib/process-code";

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
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/processes")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar o dashboard.");
        setProcesses(payload.processes ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Falha ao carregar o dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const finished = processes.filter((process) => !["IN_PROGRESS", "FAILED"].includes(process.final_status));
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
    <div className="mx-auto max-w-[1360px] space-y-7">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--primary)]">Visão geral</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[var(--foreground)]">Olá, {user.name.split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Veja o que precisa da sua atenção e acompanhe as conferências recentes.</p>
        </div>
        <Link href="/validation" className="app-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Nova conferência
        </Link>
      </section>

      {loading ? <DashboardSkeleton /> : error ? (
        <div className="app-card border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-700" role="alert">{error}</div>
      ) : (
        <>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
            <div className="app-card overflow-hidden bg-[var(--navy)] text-white">
              <div className="flex h-full flex-col justify-between gap-8 p-6 sm:p-7">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <div className="text-sm font-medium text-[#9cc7c1]">Próxima ação</div>
                    <div className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{metrics.pending}</div>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">{metrics.pending === 1 ? "conferência aguarda sua revisão" : "conferências aguardam sua revisão"}</p>
                  </div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#62d4c9]"><AlertCircle className="h-6 w-6" /></span>
                </div>
                <Link href="/pending" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#78ddd3] hover:text-white">Revisar pendências <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
            <div className="app-card p-6">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Timer className="h-5 w-5" /></span><span className="text-sm font-medium text-[var(--muted)]">Tempo médio</span></div>
              <div className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">{formatDuration(metrics.averageMs)}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">por conferência concluída</p>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric icon={Clock3} label="Em andamento" value={metrics.active} />
            <Metric icon={FileCheck2} label="Documentos analisados" value={metrics.documents} />
            <Metric icon={CheckCircle2} label="Taxa de conferência" value={`${metrics.approval}%`} />
            <Metric icon={AlertCircle} label="Pendências abertas" value={metrics.pending} />
          </section>

          <section className="app-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-5 sm:px-6">
              <div><h2 className="font-semibold text-[var(--foreground)]">Atividade recente</h2><p className="mt-1 text-xs text-[var(--muted)]">Últimas conferências processadas</p></div>
              <Link href="/history" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">Ver histórico <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {processes.slice(0, 6).map((process) => (
                <div key={process.id} className="grid gap-3 px-5 py-4 transition hover:bg-[var(--surface-subtle)] sm:grid-cols-[1fr_150px_130px] sm:items-center sm:px-6">
                  <div className="min-w-0"><div className="text-xs font-semibold text-[var(--primary)]">{processCode(process.id)}</div><div className="mt-1 truncate text-sm font-medium text-[var(--foreground)]">{process.process_documents.map((document) => document.name).join(", ") || "Sem documentos"}</div><div className="mt-1 text-xs text-[var(--muted)]">{user.role === "ADMIN" ? `${process.profiles?.name ?? "Analista"} · ` : ""}{new Date(process.started_at).toLocaleString("pt-BR")}</div></div>
                  <div className="text-xs text-[var(--muted)]">{process.process_documents.length} documento(s)</div>
                  <Status value={process.final_status} />
                </div>
              ))}
              {!processes.length ? <div className="px-6 py-14 text-center"><FileCheck2 className="mx-auto h-8 w-8 text-slate-300" /><div className="mt-3 text-sm font-medium text-[var(--foreground)]">Nenhuma conferência ainda</div><Link href="/validation" className="mt-2 inline-flex text-sm font-medium text-[var(--primary)]">Criar a primeira conferência</Link></div> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return <div className="space-y-5" aria-label="Carregando dashboard"><div className="grid gap-5 xl:grid-cols-2"><div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-slate-200" /><div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-slate-200" /></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-[var(--radius-card)] bg-slate-200" />)}</div></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: number | string }) {
  return <div className="rounded-xl border border-[var(--border)] bg-white/70 p-4"><div className="flex items-center gap-2 text-[var(--muted)]"><Icon className="h-4 w-4 text-[var(--primary)]" /><span className="text-xs font-medium">{label}</span></div><div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{value}</div></div>;
}

function Status({ value }: { value: string }) {
  const copy = ({ IN_PROGRESS: "Em análise", PENDING_REVIEW: "Com pendências", FULLY_CHECKED: "Conferido", FAILED: "Falhou" } as Record<string, string>)[value] ?? value;
  const tone = ({ IN_PROGRESS: "bg-blue-50 text-blue-700", PENDING_REVIEW: "bg-amber-50 text-amber-700", FULLY_CHECKED: "bg-emerald-50 text-emerald-700", FAILED: "bg-rose-50 text-rose-700" } as Record<string, string>)[value] ?? "bg-slate-100 text-slate-600";
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{copy}</span>;
}

function formatDuration(milliseconds: number) {
  if (!milliseconds) return "Sem dados";
  const minutes = Math.round(milliseconds / 60_000);
  return minutes < 1 ? "< 1 min" : `${minutes} min`;
}
