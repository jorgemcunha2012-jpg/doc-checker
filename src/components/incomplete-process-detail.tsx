import { AlertTriangle, ArrowLeft, Clock3, FileText } from "lucide-react";

type IncompleteProcess = {
  id: string;
  processing_status: string;
  final_status: string;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  profiles: { name: string } | null;
  process_documents: Array<{ id: string; name: string; source?: string; storage_path?: string | null }>;
};

export function IncompleteProcessDetail({
  process,
  backHref,
}: {
  process: IncompleteProcess;
  backHref: string;
}) {
  const duration = durationLabel(process.started_at, process.completed_at);
  const orphanWithoutDocuments = process.process_documents.length === 0;
  const stalled = process.final_status === "IN_PROGRESS" && elapsedMs(process.started_at, process.completed_at) >= 30 * 60 * 1000;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Diagnóstico do processo</h1>
          <p className="mt-1 text-sm text-slate-500">
            {process.profiles?.name ?? "Usuário"} · iniciado em {new Date(process.started_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <a href={backHref} className="inline-flex items-center gap-2 text-sm font-bold text-[#0f8f88]">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </a>
      </div>

      <section className={`border p-5 ${orphanWithoutDocuments || stalled || process.final_status === "FAILED" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${orphanWithoutDocuments || stalled || process.final_status === "FAILED" ? "text-amber-700" : "text-slate-500"}`} />
          <div>
            <h2 className="font-bold text-slate-950">
              {orphanWithoutDocuments
                ? "Processo sem documentos registrados"
                : stalled
                  ? "Possível processo travado"
                  : process.final_status === "FAILED"
                    ? "Processo finalizado com falha"
                    : "Processamento ainda não concluído"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {orphanWithoutDocuments
                ? "A conferência foi iniciada, mas nenhum arquivo ficou associado ao processo. Isso indica falha de criação ou upload, não processamento documental em andamento."
                : stalled
                ? "O processo permaneceu sem conclusão por mais de 30 minutos e não produziu um checklist."
                : "Ainda não existe um resultado consolidado para este processo."}
            </p>
            {process.error ? <p className="mt-3 break-words text-sm font-semibold text-rose-700">{process.error}</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Etapa registrada" value={processingStatusLabel(process.processing_status)} />
        <Metric label="Situação" value={finalStatusLabel(process.final_status)} />
        <Metric label="Tempo decorrido" value={duration} icon />
      </section>

      <section className="border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-500" />
          <h2 className="font-bold text-slate-950">Documentos enviados</h2>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {process.process_documents.length ? process.process_documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 truncate text-slate-700">{document.name}</span>
              {document.storage_path ? (
                <a
                  href={`/api/processes/${process.id}/documents/${document.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 font-bold text-[#0f8f88]"
                >
                  Visualizar
                </a>
              ) : <span className="shrink-0 text-xs text-slate-400">Original indisponível</span>}
            </div>
          )) : <p className="py-4 text-sm text-slate-500">Nenhum documento foi registrado.</p>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon = false }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="border border-slate-200 bg-white p-4">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900">
        {icon ? <Clock3 className="h-4 w-4 text-slate-400" /> : null}
        {value}
      </div>
    </div>
  );
}

function processingStatusLabel(status: string) {
  return ({ PENDING: "Aguardando início", EXTRACTING: "Extraindo dados", COMPARING: "Comparando dados", DONE: "Concluído", FAILED: "Falhou" } as Record<string, string>)[status] ?? status;
}

function finalStatusLabel(status: string) {
  return ({ IN_PROGRESS: "Em andamento", PENDING_REVIEW: "Com pendências", FULLY_CHECKED: "Conferido", FAILED: "Falhou" } as Record<string, string>)[status] ?? status;
}

function elapsedMs(startedAt: string, completedAt: string | null) {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : 0;
}

function durationLabel(startedAt: string, completedAt: string | null) {
  const totalSeconds = Math.round(elapsedMs(startedAt, completedAt) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}
