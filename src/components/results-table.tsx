"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ValidationResult, ValidationStatus } from "@/domain/validation";
import { statusCopy } from "@/lib/validation-copy";
import { StatusBadge } from "./status-badge";

type Filter = "ALL" | "DIVERGENCE" | "REVIEW_REQUIRED" | "LOW_CONFIDENCE";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "ALL", label: "Todos" },
  { id: "DIVERGENCE", label: "Divergências" },
  { id: "REVIEW_REQUIRED", label: "Revisão necessária" },
  { id: "LOW_CONFIDENCE", label: "Baixa confiança" },
];

export function ResultsTable({ results }: { results: ValidationResult[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      const matchesFilter =
        filter === "ALL" ||
        result.status === filter ||
        (filter === "REVIEW_REQUIRED" && result.status === "NOT_FOUND") ||
        (filter === "LOW_CONFIDENCE" && Math.min(result.sourceConfidence, result.targetConfidence) < 70);
      const text = `${result.field.category} ${result.field.label} ${result.sourceValue} ${result.targetValue} ${statusCopy[result.status]}`.toLowerCase();

      return matchesFilter && text.includes(query.toLowerCase());
    });
  }, [filter, query, results]);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                filter === item.id ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
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
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 lg:w-64"
            placeholder="Buscar campo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-900 text-xs uppercase text-slate-200">
              <th className="px-4 py-3 font-semibold">Campo</th>
              <th className="px-4 py-3 font-semibold">Origem</th>
              <th className="px-4 py-3 font-semibold">Destino</th>
              <th className="px-4 py-3 font-semibold">Confiança</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map((result) => (
              <ResultRow key={result.field.id} result={result} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResultRow({ result }: { result: ValidationResult }) {
  return (
    <tr className="border-b border-slate-100 align-top transition hover:bg-slate-50 last:border-0">
      <td className="px-4 py-4">
        <div className="text-sm font-semibold text-slate-950">{result.field.label}</div>
        <div className="mt-1 text-xs text-slate-500">{result.field.category}</div>
      </td>
      <td className="max-w-72 px-4 py-4 text-slate-700">
        <HighlightedValue value={result.sourceValue} diffTokens={result.sourceDiffTokens} />
      </td>
      <td className="max-w-72 px-4 py-4 text-slate-700">
        <HighlightedValue value={result.targetValue} diffTokens={result.targetDiffTokens} />
      </td>
      <td className="px-4 py-4">
        <div className="text-sm font-bold text-slate-900">{Math.min(result.sourceConfidence, result.targetConfidence)}%</div>
        <div className="mt-1 text-xs text-slate-500">Origem {result.sourceConfidence}% / Destino {result.targetConfidence}%</div>
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={result.status as ValidationStatus} />
        <div className={`mt-2 max-w-64 text-xs leading-5 ${result.status === "DIVERGENCE" ? "font-semibold text-rose-700" : "text-slate-500"}`}>
          {result.observation}
        </div>
      </td>
    </tr>
  );
}

function HighlightedValue({ value, diffTokens }: { value: string; diffTokens?: string[] }) {
  if (!diffTokens?.length) {
    return <span>{value}</span>;
  }

  const normalizedDiffTokens = new Set(diffTokens.map(normalizeToken));

  return (
    <span>
      {value.split(/(\s+)/).map((part, index) => {
        const isWhitespace = /^\s+$/.test(part);
        const isDifferent = !isWhitespace && normalizedDiffTokens.has(normalizeToken(part));

        if (!isDifferent) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        return (
          <mark key={`${part}-${index}`} className="rounded bg-rose-100 px-1 font-semibold text-rose-800 line-through decoration-rose-500 decoration-2">
            {part}
          </mark>
        );
      })}
    </span>
  );
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toUpperCase();
}
