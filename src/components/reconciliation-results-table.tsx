"use client";

import { CheckCircle2, FileSearch, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { documentSourceLabels, type DocumentSource, type FieldComparisonResult, type HumanReview, type ReconciliationStatus, type User } from "@/domain/validation";
import { statusCopy } from "@/lib/validation-copy";
import { StatusBadge } from "./status-badge";

type Filter = "ALL" | ReconciliationStatus | "MISSING";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "ALL", label: "Todos" },
  { id: "MATCH", label: "Conferidos" },
  { id: "DIVERGENCE", label: "Divergências" },
  { id: "REVIEW_REQUIRED", label: "Revisão" },
  { id: "MISSING", label: "Ausentes" },
  { id: "SOURCE_UNREADABLE", label: "Ilegíveis" },
];

export function ReconciliationResultsTable({
  results,
  sources,
  onReview,
  reviewer,
}: {
  results: FieldComparisonResult[];
  sources: DocumentSource[];
  onReview: (fieldId: string, review?: HumanReview) => void;
  reviewer: User;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [reviewingResult, setReviewingResult] = useState<FieldComparisonResult | null>(null);

  const filteredResults = useMemo(
    () =>
      results.filter((result) => {
        const hasMissing = result.observation.includes("não encontrado na fonte");
        const effectiveStatus = result.humanReview?.status === "APPROVED" ? "MATCH" : result.status;
        const matchesFilter =
          filter === "ALL" || effectiveStatus === filter || (filter === "MISSING" && hasMissing && !result.humanReview);
        const sourceText = sources
          .map((source) => result.valuesBySource[source]?.value ?? "")
          .join(" ");
        const text = `${result.field.category} ${result.field.label} ${sourceText} ${statusCopy[result.status]} ${result.observation}`.toLowerCase();
        return matchesFilter && text.includes(query.toLowerCase());
      }),
    [filter, query, results, sources],
  );
  const participantGroups = useMemo(() => {
    const groups = new Map<string, { label: string; results: FieldComparisonResult[] }>();
    for (const result of filteredResults) {
      if (!result.field.participantId) continue;
      const key = result.field.participantId;
      const group = groups.get(key) ?? { label: result.field.participantLabel ?? "Comprador", results: [] };
      group.results.push(result);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([participantId, group]) => ({ participantId, ...group }));
  }, [filteredResults]);
  const sharedResults = useMemo(() => filteredResults.filter((result) => !result.field.participantId), [filteredResults]);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                filter === item.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            className="w-full bg-transparent text-sm outline-none lg:w-64"
            placeholder="Buscar campo ou valor"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {participantGroups.map((group) => (
        <ResultGroup
          key={group.participantId}
          title={group.label}
          subtitle="Dados conferidos exclusivamente para este comprador"
          results={group.results}
          sources={sources}
          onReview={onReview}
          onOpenReview={setReviewingResult}
        />
      ))}
      {sharedResults.length ? (
        <ResultGroup
          title="Dados comuns da operação"
          subtitle="Imóvel, contrato e valores compartilhados entre os compradores"
          results={sharedResults}
          sources={sources}
          onReview={onReview}
          onOpenReview={setReviewingResult}
        />
      ) : null}
      {!participantGroups.length && !sharedResults.length ? <div className="p-8 text-center text-sm text-slate-500">Nenhum campo encontrado para este filtro.</div> : null}
      {reviewingResult ? (
        <ReviewDialog
          result={reviewingResult}
          onClose={() => setReviewingResult(null)}
          onConfirm={(review) => {
            onReview(reviewingResult.field.id, review);
            setReviewingResult(null);
          }}
          reviewer={reviewer}
        />
      ) : null}
    </section>
  );
}

function ResultGroup({
  title,
  subtitle,
  results,
  sources,
  onReview,
  onOpenReview,
}: {
  title: string;
  subtitle: string;
  results: FieldComparisonResult[];
  sources: DocumentSource[];
  onReview: (fieldId: string, review?: HumanReview) => void;
  onOpenReview: (result: FieldComparisonResult) => void;
}) {
  const pending = results.filter((result) => result.status !== "MATCH" && result.humanReview?.status !== "APPROVED").length;
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-950">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
          {pending ? `${pending} pendência${pending === 1 ? "" : "s"}` : "Tudo conferido"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-900 text-xs uppercase text-slate-200">
              <th className="px-4 py-3 font-semibold">Campo</th>
              {sources.map((source) => <th key={source} className="px-4 py-3 font-semibold">{documentSourceLabels[source]}</th>)}
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Diagnóstico e revisão</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <ResultRow key={result.field.id} result={result} sources={sources} onReview={onReview} onOpenReview={onOpenReview} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultRow({
  result,
  sources,
  onReview,
  onOpenReview,
}: {
  result: FieldComparisonResult;
  sources: DocumentSource[];
  onReview: (fieldId: string, review?: HumanReview) => void;
  onOpenReview: (result: FieldComparisonResult) => void;
}) {
  return (
    <tr className="border-b border-slate-100 align-top hover:bg-slate-50">
      <td className="px-4 py-4">
        <div className="font-semibold text-slate-950">{result.field.baseFieldId ? result.field.label.slice(0, result.field.label.lastIndexOf(" · ")) : result.field.label}</div>
        <div className="mt-1 text-xs text-slate-500">{result.field.category}</div>
      </td>
      {sources.map((source) => <td key={source} className="max-w-64 px-4 py-4 text-slate-700"><SourceValueCell source={source} result={result} /></td>)}
      <td className="px-4 py-4">
        {result.humanReview?.status === "APPROVED" ? (
          <div>
            <span className="inline-flex min-w-32 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Verificado</span>
            <div className="mt-1 text-[11px] text-slate-400">Automático: {statusCopy[result.status]}</div>
          </div>
        ) : <StatusBadge status={result.status} />}
      </td>
      <td className="max-w-80 px-4 py-4">
        <div className={`text-xs leading-5 ${result.status === "DIVERGENCE" ? "font-semibold text-rose-700" : "text-slate-600"}`}>{result.observation}</div>
        {result.humanReview ? (
          <div className="mt-3 border-l-2 border-emerald-500 pl-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />{result.status === "DIVERGENCE" ? "Divergência ignorada" : "Validado manualmente"}</div>
            {result.humanReview.justification ? <p className="mt-1 text-xs leading-5 text-slate-600">{result.humanReview.justification}</p> : null}
            <div className="mt-1 text-[11px] text-slate-400">{result.humanReview.reviewerName} · {formatReviewDate(result.humanReview.reviewedAt)}</div>
            <button className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900" onClick={() => onReview(result.field.id)}><RotateCcw className="h-3.5 w-3.5" />Desfazer</button>
          </div>
        ) : result.status !== "MATCH" ? (
          <button className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700" onClick={() => onOpenReview(result)}>
            <CheckCircle2 className="h-3.5 w-3.5" />{result.status === "DIVERGENCE" ? "Ignorar divergência" : "Marcar como verificado"}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function ReviewDialog({
  result,
  onClose,
  onConfirm,
  reviewer,
}: {
  result: FieldComparisonResult;
  onClose: () => void;
  onConfirm: (review: HumanReview) => void;
  reviewer: User;
}) {
  const [justification, setJustification] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 id="review-title" className="text-lg font-bold text-slate-950">
              {result.status === "DIVERGENCE" ? `Ignorar divergência em “${result.field.label}”` : `Verificar “${result.field.label}”`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A decisão automática e os valores originais continuarão registrados para auditoria e evolução das regras.
            </p>
          </div>
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} title="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          <div className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">{result.observation}</div>
          <label className="mt-4 block text-sm font-bold text-slate-800" htmlFor="review-justification">Observação <span className="font-normal text-slate-400">(opcional)</span></label>
          <textarea
            id="review-justification"
            className="mt-2 min-h-28 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
            placeholder="Ex.: diferença apenas de redação; os dados representam a mesma informação."
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button className="min-h-10 rounded-md px-4 text-sm font-bold text-slate-600 hover:bg-slate-100" onClick={onClose}>Cancelar</button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={() =>
              onConfirm({
                status: "APPROVED",
                justification: justification.trim(),
                reviewerId: reviewer.id,
                reviewerName: reviewer.name,
                reviewedAt: new Date().toISOString(),
              })
            }
          >
            <ShieldCheck className="h-4 w-4" />
            {result.status === "DIVERGENCE" ? "Ignorar e verificar" : "Confirmar verificação"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function SourceValueCell({ source, result }: { source: DocumentSource; result: FieldComparisonResult }) {
  const sourceValue = result.valuesBySource[source];
  if (!sourceValue) return <span className="text-slate-400">Não aplicável</span>;
  if (!sourceValue.value) return <span className="font-semibold text-amber-700">Não encontrado</span>;

  const location = sourceValue.sourceLocation;
  return (
    <div>
      <HighlightedValue value={sourceValue.value} diffTokens={sourceValue.diffTokens} />
      <div className="mt-1 text-xs font-semibold text-slate-500">{sourceValue.confidence}% confiança</div>
      {location ? (
        <details className="mt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-teal-700">
            <FileSearch className="h-3.5 w-3.5" />
            Ver evidência
          </summary>
          <div className="mt-2 rounded-md border border-slate-200 bg-white p-2 text-xs leading-5 text-slate-600">
            {location.page ? <div>Página {location.page}</div> : null}
            {location.section ? <div>Seção: {location.section}</div> : null}
            {location.rawText ? <blockquote className="mt-1 border-l-2 border-teal-600 pl-2">{location.rawText}</blockquote> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function HighlightedValue({ value, diffTokens }: { value: string; diffTokens?: string[] }) {
  if (!diffTokens?.length) return <span>{value}</span>;
  const normalizedTokens = new Set(diffTokens.map(normalizeToken));
  return (
    <span>
      {value.split(/(\s+)/).map((part, index) =>
        normalizedTokens.has(normalizeToken(part)) ? (
          <mark key={`${part}-${index}`} className="rounded bg-rose-100 px-1 font-semibold text-rose-800 line-through decoration-rose-500 decoration-2">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  );
}

function normalizeToken(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\p{L}\p{N}]+/gu, "").toUpperCase();
}
