import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw } from "lucide-react";
import type { ChecklistField, DocumentSource, ExtractionQualityReport } from "@/domain/validation";
import { documentSourceLabels } from "@/domain/validation";
import { humanFieldLabel } from "@/domain/field-labels";

export function ExtractionQualityPanel({
  reports,
  checklist,
}: {
  reports?: Partial<Record<DocumentSource, ExtractionQualityReport>>;
  checklist: ChecklistField[];
}) {
  const assessed = Object.values(reports ?? {}).filter((report): report is ExtractionQualityReport =>
    Boolean(report && report.status !== "NOT_ASSESSED"),
  );
  if (!assessed.length) return null;
  const label = (fieldId: string) => humanFieldLabel(fieldId, checklist);

  return (
    <details className="group border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[#0faaa2] focus-visible:ring-inset group-open:border-b group-open:border-slate-200 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="font-bold text-slate-950">Qualidade da extração</h2>
          <p className="mt-1 text-sm text-slate-500">Cobertura dos campos críticos antes da comparação documental.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">{assessed.length} fonte(s) avaliada(s)</span>
          <ChevronDown className="h-5 w-5 text-slate-500 transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {assessed.map((report) => (
          <div key={report.source} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {report.status === "COMPLETE"
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                <h3 className="text-sm font-bold text-slate-900">{documentSourceLabels[report.source]}</h3>
              </div>
              <span className={`text-sm font-bold ${report.status === "COMPLETE" ? "text-emerald-700" : "text-amber-700"}`}>
                {report.coverage}% de cobertura
              </span>
            </div>
            {(report.recoveredFields ?? []).length ? (
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-blue-700">
                <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Recuperados automaticamente: {(report.recoveredFields ?? []).map(label).join(", ")}.
              </div>
            ) : null}
            {(report.deterministicFields ?? []).length ? (
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Confirmados por leitura determinística: {(report.deterministicFields ?? []).map(label).join(", ")}.
              </div>
            ) : null}
            {(report.missingCriticalFields ?? []).length ? (
              <p className="mt-3 text-xs leading-5 text-amber-800">
                Não extraídos após nova tentativa: {(report.missingCriticalFields ?? []).map(label).join(", ")}.
              </p>
            ) : null}
            {(report.lowConfidenceCriticalFields ?? []).length ? (
              <p className="mt-3 text-xs leading-5 text-amber-800">
                Extraídos com baixa confiança: {(report.lowConfidenceCriticalFields ?? []).map(label).join(", ")}.
              </p>
            ) : null}
            {(report.ambiguousCriticalFields ?? []).length ? (
              <p className="mt-3 text-xs leading-5 text-rose-700">
                Com conflito interno na mesma fonte: {(report.ambiguousCriticalFields ?? []).map(label).join(", ")}.
              </p>
            ) : null}
            {!(report.missingCriticalFields ?? []).length && !(report.lowConfidenceCriticalFields ?? []).length && !(report.ambiguousCriticalFields ?? []).length ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">Todos os campos críticos esperados foram extraídos com confiança suficiente.</p>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}
