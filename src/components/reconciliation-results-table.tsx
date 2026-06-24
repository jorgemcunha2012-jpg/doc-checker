"use client";

import { FileSearch, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { documentSourceLabels, type DocumentSource, type FieldComparisonResult, type ReconciliationStatus } from "@/domain/validation";
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
}: {
  results: FieldComparisonResult[];
  sources: DocumentSource[];
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const filteredResults = useMemo(
    () =>
      results.filter((result) => {
        const hasMissing = result.observation.includes("não encontrado na fonte");
        const matchesFilter =
          filter === "ALL" || result.status === filter || (filter === "MISSING" && hasMissing);
        const sourceText = sources
          .map((source) => result.valuesBySource[source]?.value ?? "")
          .join(" ");
        const text = `${result.field.category} ${result.field.label} ${sourceText} ${statusCopy[result.status]} ${result.observation}`.toLowerCase();
        return matchesFilter && text.includes(query.toLowerCase());
      }),
    [filter, query, results, sources],
  );

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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-900 text-xs uppercase text-slate-200">
              <th className="px-4 py-3 font-semibold">Campo</th>
              {sources.map((source) => (
                <th key={source} className="px-4 py-3 font-semibold">{documentSourceLabels[source]}</th>
              ))}
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map((result) => (
              <tr key={result.field.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                <td className="px-4 py-4">
                  <div className="font-semibold text-slate-950">{result.field.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{result.field.category}</div>
                </td>
                {sources.map((source) => (
                  <td key={source} className="max-w-64 px-4 py-4 text-slate-700">
                    <SourceValueCell source={source} result={result} />
                  </td>
                ))}
                <td className="px-4 py-4">
                  <StatusBadge status={result.status} />
                </td>
                <td className={`max-w-72 px-4 py-4 text-xs leading-5 ${result.status === "DIVERGENCE" ? "font-semibold text-rose-700" : "text-slate-600"}`}>
                  {result.observation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
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
