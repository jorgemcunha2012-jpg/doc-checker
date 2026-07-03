"use client";

import { Clock3, Eye, FileClock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

type HistoryProcess = {
  id: string;
  final_status: string;
  started_at: string;
  completed_at: string | null;
  profiles: { name: string } | null;
  process_documents: Array<{ id: string; name: string; source?: string; available: boolean }>;
};

export function ProcessHistory({ showAnalyst, status }: { showAnalyst: boolean; status?: string }) {
  const [processes, setProcesses] = useState<HistoryProcess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/processes${status ? `?status=${encodeURIComponent(status)}` : ""}`)
      .then((response) => response.json())
      .then((payload) => setProcesses(payload.processes ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  return (
    <div className="divide-y divide-slate-100 border border-slate-200 bg-white">
      {processes.map((process) => (
        <article key={process.id} className="grid gap-4 p-5 lg:grid-cols-[180px_1fr_180px_120px] lg:items-center">
          <div>
            <div className="text-sm font-bold text-slate-900">{new Date(process.started_at).toLocaleDateString("pt-BR")}</div>
            <div className="mt-1 text-xs text-slate-500">{new Date(process.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
            {showAnalyst ? <div className="mt-2 text-xs font-semibold text-blue-700">{process.profiles?.name ?? "Analista"}</div> : null}
          </div>
          <div className="space-y-1">
            {process.process_documents.map((document) => <div key={document.id} className="truncate text-sm text-slate-700">{document.name}</div>)}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-700">{statusLabel(process.final_status)}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{durationLabel(process.started_at, process.completed_at)}</div>
          </div>
          {process.final_status === "IN_PROGRESS" || process.final_status === "FAILED" ? (
            <span className="text-center text-xs font-semibold text-slate-400">Resultado indisponível</span>
          ) : (
            <Link href={{ pathname: `/history/${process.id}` }} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-blue-500 hover:text-blue-700">
              <Eye className="h-4 w-4" /> Abrir
            </Link>
          )}
        </article>
      ))}
      {!processes.length ? <div className="py-16 text-center"><FileClock className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Nenhuma conferência encontrada.</p></div> : null}
    </div>
  );
}

function statusLabel(status: string) {
  return ({ IN_PROGRESS: "Em andamento", PENDING_REVIEW: "Com pendências", FULLY_CHECKED: "Conferido", FAILED: "Falhou" } as Record<string, string>)[status] ?? status;
}

function durationLabel(startedAt: string, completedAt: string | null) {
  const milliseconds = (completedAt ? new Date(completedAt).getTime() : Date.now()) - new Date(startedAt).getTime();
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.max(0, Math.round(milliseconds / 1_000) % 60);
  return minutes ? `${minutes}min ${seconds}s` : `${seconds}s`;
}
