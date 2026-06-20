"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Database, Download, FileCheck2, FileSearch, Layers3, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import type { ValidationProcess, ValidationRun, ValidationType } from "@/domain/validation";
import { defaultOrganization } from "@/domain/tenant";
import { validationTypeCopy } from "@/lib/validation-copy";
import { ClientUploadedDocument, FileDropZone } from "./file-drop-zone";
import { ResultsTable } from "./results-table";

const validationTypes: ValidationType[] = ["MINUTA", "ITBI"];

export function ConferiaWorkspace() {
  const [validationType, setValidationType] = useState<ValidationType>("MINUTA");
  const [documents, setDocuments] = useState<ClientUploadedDocument[]>([]);
  const [processId, setProcessId] = useState<string | null>(null);
  const [process, setProcess] = useState<ValidationProcess | null>(null);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCopy = validationTypeCopy[validationType];

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const files = event.clipboardData?.files;
      if (!files?.length) {
        return;
      }

      const pastedDocuments = Array.from(files).map<ClientUploadedDocument>((file, index) => ({
        id: crypto.randomUUID(),
        organizationId: defaultOrganization.id,
        name: file.name || `print-colado-${index + 1}.png`,
        type: "PRINT",
        mimeType: file.type || "image/png",
        sizeBytes: file.size,
        file,
      }));

      setDocuments((current) => [...current, ...pastedDocuments]);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    setDocuments([]);
    setProcessId(null);
    setProcess(null);
    setRun(null);
  }, [validationType]);

  useEffect(() => {
    if (!processId) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/validation-processes/${processId}`);
      const nextProcess = (await response.json()) as ValidationProcess;
      setProcess(nextProcess);

      if (nextProcess.status === "DONE") {
        setRun(nextProcess.result ?? null);
        window.clearInterval(interval);
      }

      if (nextProcess.status === "FAILED") {
        window.clearInterval(interval);
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [processId]);

  const hasDocuments = documents.length > 0;
  const isProcessing = isSubmitting || process?.status === "PENDING" || process?.status === "EXTRACTING" || process?.status === "COMPARING";

  const processSteps = useMemo(
    () => [
      { icon: FileSearch, label: validationType === "MINUTA" ? "Extrair dados do print" : "Ler guia DTI/ITBI" },
      { icon: FileCheck2, label: "Extrair dados do contrato" },
      { icon: Layers3, label: "Comparar campos e regras" },
      { icon: CheckCircle2, label: "Gerar checklist auditável" },
    ],
    [validationType],
  );

  async function handleRunValidation() {
    setIsSubmitting(true);
    setRun(null);
    setProcess(null);

    const formData = new FormData();
    formData.set("validationType", validationType);
    documents.forEach((document) => formData.append("documents", document.file, document.name));

    const response = await fetch("/api/validation-processes", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { processId?: string; error?: string };
    setIsSubmitting(false);

    if (!response.ok || !payload.processId) {
      setProcess({
        id: "local_error",
        organizationId: defaultOrganization.id,
        userId: "usr_conferia_analista",
        validationType,
        status: "FAILED",
        documents,
        error: payload.error ?? "Falha ao iniciar processo.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setProcessId(payload.processId);
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-700 text-white">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-950">ConferIA</div>
              <div className="text-xs font-medium text-slate-500">Conferência documental imobiliária</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:flex">
            <Database className="h-4 w-4" aria-hidden="true" />
            SaaS-ready
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h1 className="text-xl font-bold text-slate-950">Nova conferência</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Selecione o fluxo documental e execute uma análise com extração IA/OCR e checklist configurável.</p>

            <div className="mt-5 space-y-3">
              {validationTypes.map((type) => {
                const copy = validationTypeCopy[type];
                const isSelected = validationType === type;

                return (
                  <button
                    key={type}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      isSelected ? "border-teal-700 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    onClick={() => setValidationType(type)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-950">{copy.title}</span>
                      <ShieldCheck className={`h-5 w-5 ${isSelected ? "text-teal-700" : "text-slate-400"}`} aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{copy.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-950">Pipeline modular</h2>
            <div className="mt-4 space-y-3">
              {processSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-teal-700">
                    <step.icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{step.label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-700">{selectedCopy.shortTitle}</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">{selectedCopy.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{selectedCopy.description}</p>
              </div>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!hasDocuments || isProcessing}
                onClick={handleRunValidation}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Processar conferência
              </button>
            </div>
          </div>

          <FileDropZone validationType={validationType} documents={documents} onDocumentsChange={setDocuments} />

          {process && process.status !== "DONE" ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                {process.status === "FAILED" ? <AlertTriangle className="h-5 w-5 text-rose-600" /> : <Loader2 className="h-5 w-5 animate-spin text-teal-700" />}
                <div>
                  <div className="text-sm font-bold text-slate-950">Status do processo: {process.status}</div>
                  {process.error ? <div className="mt-1 text-sm text-rose-700">{process.error}</div> : <div className="mt-1 text-sm text-slate-500">A tela consulta o processo automaticamente a cada 2,5 segundos.</div>}
                </div>
              </div>
            </div>
          ) : null}

          {run ? (
            <>
              {run.usedPdfVisionFallback ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">Fallback de visão utilizado</div>
                    <div className="mt-1 text-sm">O PDF tinha pouco ou nenhum texto extraível e foi enviado para análise visual.</div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard label="Total de campos conferidos" value={run.summary.totalChecked} tone="neutral" />
                <SummaryCard label="Total de divergências" value={run.summary.divergences} tone="danger" />
                <SummaryCard label="Total pendente de revisão" value={run.summary.reviewRequired} tone="warning" />
              </div>
              {processId ? (
                <a
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  href={`/api/validation-processes/${processId}/report`}
                >
                  <Download className="h-4 w-4" />
                  Exportar relatório
                </a>
              ) : null}
              <ResultsTable results={run.results} />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-8 text-center">
              <FileCheck2 className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
              <h2 className="mt-3 text-base font-bold text-slate-950">Checklist aguardando processamento</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Adicione ao menos um documento para simular a extração OCR/IA e gerar a tabela de conferência.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "danger" | "warning" }) {
  const toneClasses = {
    neutral: "text-slate-950 bg-slate-100",
    danger: "text-rose-700 bg-rose-50",
    warning: "text-amber-700 bg-amber-50",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex h-9 min-w-12 items-center justify-center rounded-md px-3 text-lg font-bold ${toneClasses[tone]}`}>{value}</div>
      <div className="mt-3 text-sm font-semibold text-slate-700">{label}</div>
    </div>
  );
}
