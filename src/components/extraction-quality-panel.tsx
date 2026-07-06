import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { ChecklistField, DocumentSource, ExtractionQualityReport } from "@/domain/validation";
import { documentSourceLabels } from "@/domain/validation";

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
  const labels = new Map(checklist.map((field) => [field.id, field.label]));

  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-bold text-slate-950">Qualidade da extração</h2>
        <p className="mt-1 text-sm text-slate-500">Cobertura dos campos críticos antes da comparação documental.</p>
      </div>
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
                Recuperados automaticamente: {(report.recoveredFields ?? []).map((fieldId) => labels.get(fieldId) ?? fieldId).join(", ")}.
              </div>
            ) : null}
            {(report.deterministicFields ?? []).length ? (
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Confirmados por leitura determinística: {(report.deterministicFields ?? []).map((fieldId) => labels.get(fieldId) ?? fieldId).join(", ")}.
              </div>
            ) : null}
            {(report.missingCriticalFields ?? []).length ? (
              <p className="mt-3 text-xs leading-5 text-amber-800">
                Não extraídos após nova tentativa: {(report.missingCriticalFields ?? []).map((fieldId) => labels.get(fieldId) ?? fieldId).join(", ")}.
              </p>
            ) : null}
            {(report.lowConfidenceCriticalFields ?? []).length ? (
              <p className="mt-3 text-xs leading-5 text-amber-800">
                Extraídos com baixa confiança: {(report.lowConfidenceCriticalFields ?? []).map((fieldId) => labels.get(fieldId) ?? fieldId).join(", ")}.
              </p>
            ) : null}
            {(report.ambiguousCriticalFields ?? []).length ? (
              <p className="mt-3 text-xs leading-5 text-rose-700">
                Com conflito interno na mesma fonte: {(report.ambiguousCriticalFields ?? []).map((fieldId) => labels.get(fieldId) ?? fieldId).join(", ")}.
              </p>
            ) : null}
            {!(report.missingCriticalFields ?? []).length && !(report.lowConfidenceCriticalFields ?? []).length && !(report.ambiguousCriticalFields ?? []).length ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">Todos os campos críticos esperados foram extraídos com confiança suficiente.</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
