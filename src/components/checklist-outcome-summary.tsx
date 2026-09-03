import type { DocumentSource, ReconciliationRun } from "@/domain/validation";
import { documentSourceLabels } from "@/domain/validation";

export function ChecklistOutcomeSummary({ run }: { run: ReconciliationRun }) {
  const matching = run.results.filter((result) => result.status === "MATCH").length;
  const absent = run.results.filter((result) => result.status === "ABSENT").length;

  return (
    <section className="border border-slate-200 bg-white p-4">
      <div>
        <h2 className="font-bold text-slate-950">Resumo da conferência</h2>
        <p className="mt-1 text-sm text-slate-500">Checklist aplicado e dados localizados em cada documento enviado.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Itens do checklist" value={`${run.checklist.length}`} detail="itens avaliados" />
        <Metric label="Campos conferem" value={`${matching}`} detail="valores equivalentes entre as fontes" tone="success" />
        <Metric label="Campos ausentes" value={`${absent}`} detail="ausência identificada por fonte" tone="warning" />
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Extração por documento</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {run.participatingSources.map((source) => <SourceExtraction key={source} run={run} source={source} />)}
        </div>
      </div>
    </section>
  );
}

function SourceExtraction({ run, source }: { run: ReconciliationRun; source: DocumentSource }) {
  const applicable = run.checklist.filter((field) => field.expectedSources?.includes(source));
  const extracted = applicable.filter((field) => {
    const value = run.results.find((result) => result.field.id === field.id)?.valuesBySource[source]?.value;
    return value !== null && value !== undefined && String(value).trim() !== "";
  });

  return (
    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-sm font-bold text-slate-900">Extração {documentSourceLabels[source]}</div>
      <div className="mt-1 text-sm text-slate-600"><strong className="text-slate-900">{extracted.length}/{applicable.length}</strong> campos do checklist localizados</div>
    </div>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-slate-950";
  return <div className="border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
}
