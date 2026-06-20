"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ValidationResult, ValidationStatus } from "@/domain/validation";
import { statusCopy } from "@/lib/validation-copy";
import { StatusBadge } from "./status-badge";

type Filter = "ALL" | "DIVERGENCE" | "REVIEW_REQUIRED";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "ALL", label: "Todos" },
  { id: "DIVERGENCE", label: "Divergências" },
  { id: "REVIEW_REQUIRED", label: "Revisão necessária" },
];

export function ResultsTable({ results }: { results: ValidationResult[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      const matchesFilter =
        filter === "ALL" ||
        result.status === filter ||
        (filter === "REVIEW_REQUIRED" && result.status === "NOT_FOUND");
      const text = `${result.field.category} ${result.field.label} ${result.sourceValue} ${result.targetValue} ${statusCopy[result.status]}`.toLowerCase();

      return matchesFilter && text.includes(query.toLowerCase());
    });
  }, [filter, query, results]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                filter === item.id ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
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
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-4 py-3 font-semibold">Campo</th>
              <th className="px-4 py-3 font-semibold">Origem</th>
              <th className="px-4 py-3 font-semibold">Destino</th>
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
    <tr className="border-b border-slate-100 align-top last:border-0">
      <td className="px-4 py-4">
        <div className="text-sm font-semibold text-slate-950">{result.field.label}</div>
        <div className="mt-1 text-xs text-slate-500">{result.field.category}</div>
      </td>
      <td className="max-w-72 px-4 py-4 text-slate-700">{result.sourceValue}</td>
      <td className="max-w-72 px-4 py-4 text-slate-700">{result.targetValue}</td>
      <td className="px-4 py-4">
        <StatusBadge status={result.status as ValidationStatus} />
        <div className="mt-2 max-w-56 text-xs text-slate-500">{result.observation}</div>
      </td>
    </tr>
  );
}
