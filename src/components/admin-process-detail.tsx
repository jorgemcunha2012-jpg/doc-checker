"use client";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { HumanReview, ReconciliationRun, User } from "@/domain/validation";
import { ReconciliationResultsTable } from "./reconciliation-results-table";

type ReviewRow = { field_id: string; status: "APPROVED" | "REJECTED"; justification: string; reviewer_id: string; reviewer_name: string; reviewed_at: string };

export function AdminProcessDetail({
  process,
  reviews,
  currentUser,
  backHref = "/admin",
  embedded = false,
}: {
  process: { id: string; result: ReconciliationRun; final_status: string; started_at: string; profiles: { name: string } | null; process_documents: Array<{ id: string; name: string; source?: string; storage_path?: string | null }> };
  reviews: ReviewRow[];
  currentUser: User;
  backHref?: string;
  embedded?: boolean;
}) {
  const [reportFilter, setReportFilter] = useState<"ALL" | "DIVERGENCES" | "PENDING" | "CHECKED">("ALL");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [run, setRun] = useState<ReconciliationRun>({
    ...process.result,
    id: process.id,
    results: process.result.results.map((result) => {
      const row = reviews.find((review) => review.field_id === result.field.id);
      return row ? { ...result, humanReview: { status: row.status, justification: row.justification, reviewerId: row.reviewer_id, reviewerName: row.reviewer_name, reviewedAt: row.reviewed_at } } : result;
    }),
  });
  async function review(fieldId: string, value?: HumanReview) {
    const response = await fetch(`/api/processes/${process.id}/review${value ? "" : `?fieldId=${encodeURIComponent(fieldId)}`}`, {
      method: value ? "PUT" : "DELETE", headers: { "Content-Type": "application/json" },
      body: value ? JSON.stringify({ fieldId, justification: value.justification }) : undefined,
    });
    if (!response.ok) return;
    const saved = value ? (await response.json()).review : undefined;
    setRun((current) => ({ ...current, results: current.results.map((result) => result.field.id === fieldId ? { ...result, humanReview: saved } : result) }));
  }

  async function exportReport() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/reports/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run, filter: reportFilter }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Não foi possível gerar o relatório.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conferia-${process.id}-${reportFilter.toLowerCase()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Não foi possível gerar o relatório.");
    } finally {
      setExporting(false);
    }
  }

  return <main className={embedded ? "" : "min-h-screen bg-slate-50"}>{!embedded ? <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><div className="font-bold">Resultado do processo</div><div className="text-xs text-slate-500">{process.profiles?.name} · {new Date(process.started_at).toLocaleString("pt-BR")}</div></div><a href={backHref} className="text-sm font-bold text-blue-600">Voltar</a></div></header> : null}<div className={`mx-auto max-w-7xl space-y-5 ${embedded ? "" : "px-5 py-8"}`}>{embedded ? <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-2xl font-bold text-slate-950">Resultado do processo</h1><p className="mt-1 text-sm text-slate-500">{process.profiles?.name} · {new Date(process.started_at).toLocaleString("pt-BR")}</p></div><a href={backHref} className="text-sm font-bold text-[#0f8f88]">Voltar</a></div> : null}<section className="flex flex-col gap-3 border border-slate-200 bg-white p-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between"><div><div className="text-xs font-bold uppercase text-slate-500">Exportar conferência</div><p className="mt-1 text-sm text-slate-500">Gere um PDF completo ou somente com os itens selecionados.</p></div><div className="flex flex-col gap-2 sm:flex-row"><select aria-label="Filtro do relatório" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700" value={reportFilter} onChange={(event) => setReportFilter(event.target.value as typeof reportFilter)}><option value="ALL">Relatório completo</option><option value="DIVERGENCES">Somente divergências pendentes</option><option value="PENDING">Todas as pendências</option><option value="CHECKED">Somente itens conferidos</option></select><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400" onClick={exportReport} disabled={exporting}>{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? "Gerando PDF..." : "Exportar PDF"}</button></div>{exportError ? <p className="text-sm font-semibold text-rose-600 lg:basis-full">{exportError}</p> : null}</section><section className="border border-slate-200 bg-white p-4"><div className="text-xs font-bold uppercase text-slate-500">Documentos</div>{process.process_documents.map((document) => <div key={document.id} className="mt-2 flex items-center justify-between gap-3 text-sm"><span className="truncate">{document.name}</span>{document.storage_path ? <a href={`/api/processes/${process.id}/documents/${document.id}`} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-[#0f8f88]">Visualizar</a> : <span className="shrink-0 text-xs text-slate-400">Original indisponível</span>}</div>)}</section><ReconciliationResultsTable results={run.results} sources={run.participatingSources} onReview={review} reviewer={currentUser} /></div></main>;
}
