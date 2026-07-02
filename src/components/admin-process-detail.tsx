"use client";
import { useState } from "react";
import type { HumanReview, ReconciliationRun, User } from "@/domain/validation";
import { ReconciliationResultsTable } from "./reconciliation-results-table";

type ReviewRow = { field_id: string; status: "APPROVED" | "REJECTED"; justification: string; reviewer_id: string; reviewer_name: string; reviewed_at: string };

export function AdminProcessDetail({
  process,
  reviews,
  currentUser,
  backHref = "/admin",
}: {
  process: { id: string; result: ReconciliationRun; final_status: string; started_at: string; profiles: { name: string } | null; process_documents: Array<{ id: string; name: string; source?: string; storage_path?: string | null }> };
  reviews: ReviewRow[];
  currentUser: User;
  backHref?: string;
}) {
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
  return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><div className="font-bold">Resultado do processo</div><div className="text-xs text-slate-500">{process.profiles?.name} · {new Date(process.started_at).toLocaleString("pt-BR")}</div></div><a href={backHref} className="text-sm font-bold text-blue-600">Voltar</a></div></header><div className="mx-auto max-w-7xl space-y-5 px-5 py-8"><section className="border border-slate-200 bg-white p-4"><div className="text-xs font-bold uppercase text-slate-500">Documentos</div>{process.process_documents.map((document) => <div key={document.id} className="mt-2 flex items-center justify-between gap-3 text-sm"><span className="truncate">{document.name}</span>{document.storage_path ? <a href={`/api/processes/${process.id}/documents/${document.id}`} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-blue-600">Visualizar</a> : <span className="shrink-0 text-xs text-slate-400">Original indisponível</span>}</div>)}</section><ReconciliationResultsTable results={run.results} sources={run.participatingSources} onReview={review} reviewer={currentUser} /></div></main>;
}
