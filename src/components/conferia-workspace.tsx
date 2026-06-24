"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Check, CheckCircle2, Download, FileCheck2, FileSearch, Layers3, Loader2, ScanText, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import type { HumanReview, ReconciliationRun, ValidationProcess, ValidationRun } from "@/domain/validation";
import { documentSourceLabels } from "@/domain/validation";
import { defaultOrganization } from "@/domain/tenant";
import { ClientUploadedDocument, FileDropZone } from "./file-drop-zone";
import { ReconciliationResultsTable } from "./reconciliation-results-table";

const validationType = "RECONCILIATION" as const;

export function ConferiaWorkspace() {
  const [documents, setDocuments] = useState<ClientUploadedDocument[]>([]);
  const [processId, setProcessId] = useState<string | null>(null);
  const [process, setProcess] = useState<ValidationProcess | null>(null);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!run || run.validationType !== "RECONCILIATION") return;
    const saved = window.localStorage.getItem(reviewStorageKey(run.id));
    if (!saved) return;

    try {
      const reviews = JSON.parse(saved) as Record<string, HumanReview>;
      setRun({
        ...run,
        results: run.results.map((result) => ({
          ...result,
          humanReview: reviews[result.field.id],
        })),
      });
    } catch {
      window.localStorage.removeItem(reviewStorageKey(run.id));
    }
    // Reviews are hydrated once when a new run arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id]);

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
        source: "DADOS_RESERVA",
        file,
      }));

      setDocuments((current) => [...current, ...pastedDocuments]);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    if (!processingStartedAt || !isSubmitting) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - processingStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSubmitting, processingStartedAt]);

  useEffect(() => {
    if (!processId) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/validation-processes/${processId}`);
      const nextProcess = await readJsonSafely<ValidationProcess & { error?: string }>(response);

      if (!response.ok) {
        setProcess((current) =>
          current
            ? {
                ...current,
                status: "FAILED",
                error: nextProcess?.error ?? "Falha ao consultar o processo.",
                updatedAt: new Date().toISOString(),
              }
            : null,
        );
        window.clearInterval(interval);
        return;
      }

      if (!nextProcess) {
        window.clearInterval(interval);
        return;
      }

      setProcess(nextProcess);

      if (nextProcess.status === "DONE") {
        setRun(nextProcess.result ?? null);
        setProcessId(null);
        window.clearInterval(interval);
      }

      if (nextProcess.status === "FAILED") {
        window.clearInterval(interval);
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [processId]);

  const hasDocuments = new Set(documents.map((document) => document.source).filter(Boolean)).size >= 2;
  const isProcessing = isSubmitting || process?.status === "PENDING" || process?.status === "EXTRACTING" || process?.status === "COMPARING";

  const processSteps = useMemo(
    () => [
      { icon: FileSearch, label: "Identificando documentos", threshold: 0 },
      { icon: ScanText, label: "Extraindo dados e evidências", threshold: 10 },
      { icon: Layers3, label: "Comparando informações", threshold: 55 },
      { icon: CheckCircle2, label: "Montando o checklist", threshold: 95 },
    ],
    [],
  );

  async function handleRunValidation() {
    setIsSubmitting(true);
    setProcessingStartedAt(Date.now());
    setElapsedSeconds(0);
    setRun(null);
    setProcess(null);

    const formData = new FormData();
    formData.set("validationType", validationType);
    documents.forEach((document) => formData.append("documents", document.file, document.name));
    formData.set("documentSources", JSON.stringify(documents.map((document) => document.source ?? "SIOPI")));

    const response = await fetch("/api/validation-processes", {
      method: "POST",
      body: formData,
    });
    const payload = await readJsonSafely<{ processId?: string; process?: ValidationProcess; error?: string }>(response);
    setIsSubmitting(false);
    setProcessingStartedAt(null);

    if (!response.ok || !payload?.processId) {
      setProcess({
        id: "local_error",
        organizationId: defaultOrganization.id,
        userId: "usr_conferia_analista",
        validationType,
        status: "FAILED",
        documents,
        error: payload?.error ?? "Falha ao iniciar processo.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (payload.process) {
      setProcess(payload.process);
    }

    if (payload.process?.status === "DONE") {
      setRun(payload.process.result ?? null);
      setProcessId(null);
      return;
    }

    if (payload.process?.status === "FAILED") {
      setProcessId(null);
      return;
    }

    setProcessId(payload.processId);
  }

  async function handleExportReport() {
    if (!run) {
      return;
    }

    const response = await fetch("/api/reports/validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run),
    });

    if (!response.ok) {
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conferia-${run.id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleReview(fieldId: string, review?: HumanReview) {
    setRun((current) => {
      if (!current || current.validationType !== "RECONCILIATION") return current;
      const next: ReconciliationRun = {
        ...current,
        results: current.results.map((result) =>
          result.field.id === fieldId
            ? { ...result, humanReview: review }
            : result,
        ),
      };
      const reviews = Object.fromEntries(
        next.results
          .filter((result) => result.humanReview)
          .map((result) => [result.field.id, result.humanReview]),
      );
      window.localStorage.setItem(reviewStorageKey(next.id), JSON.stringify(reviews));
      return next;
    });
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563eb] text-white">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-950">ConferIA</div>
              <div className="text-xs font-medium text-slate-500">Conferência documental imobiliária</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Sistema operacional
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-[#f8fafc]">
        <div className="mx-auto max-w-7xl px-5 py-9 sm:py-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#2563eb]">
            <Sparkles className="h-4 w-4" />
            Checklist inteligente com IA
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold text-slate-950 sm:text-4xl">Conferência documental imobiliária</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Envie os documentos do processo. A ConferIA identifica cada fonte, extrai as informações e apresenta tudo o que confere, diverge ou precisa de revisão.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Nova conferência</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Adicione pelo menos dois documentos. Você poderá revisar a identificação de cada fonte antes de processar.</p>
              </div>
            </div>
            <button
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#2563eb] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!hasDocuments || isProcessing}
              onClick={handleRunValidation}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Iniciar conferência
            </button>
          </div>

          <FileDropZone validationType={validationType} documents={documents} onDocumentsChange={setDocuments} />

          {isProcessing ? <ProcessingPanel steps={processSteps} elapsedSeconds={elapsedSeconds} documentCount={documents.length} /> : null}
          {process?.status === "FAILED" ? <ProcessError message={process.error} /> : null}

          {run ? (
            <>
              {run.validationType === "RECONCILIATION" ? <ReviewProgress run={run} /> : null}
              {run.usedPdfVisionFallback ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">
                      {run.validationType === "RECONCILIATION" ? "Fonte sem texto extraível" : "Fallback de visão utilizado"}
                    </div>
                    <div className="mt-1 text-sm">
                      {run.validationType === "RECONCILIATION"
                        ? "Um PDF exigia OCR visual e foi sinalizado como fonte ilegível para não comprometer as demais fontes."
                        : "O PDF tinha pouco ou nenhum texto extraível e exigiu análise visual."}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={`grid gap-3 ${run.validationType === "RECONCILIATION" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
                <SummaryCard label="Total de campos conferidos" value={run.summary.totalChecked} tone="neutral" />
                <SummaryCard label="Campos conferidos" value={finalResultCounts(run).checked} tone="success" />
                <SummaryCard label="Divergências pendentes" value={finalResultCounts(run).divergences} tone="danger" />
                <SummaryCard label="Revisões pendentes" value={finalResultCounts(run).reviews} tone="warning" />
                {run.validationType === "RECONCILIATION" ? (
                  <SummaryCard label="Campos em fonte ilegível" value={run.summary.unreadable} tone="warning" />
                ) : null}
              </div>
              {run.validationType === "RECONCILIATION" ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {run.participatingSources.map((source) => (
                    <div key={source} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-bold uppercase text-slate-500">{documentSourceLabels[source]}</div>
                      <div className="mt-2 text-sm text-slate-700">
                        {run.summary.missingBySource[source] ?? 0} ausentes · {run.summary.unreadableBySource[source] ?? 0} ilegíveis
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={handleExportReport}
              >
                <Download className="h-4 w-4" />
                Exportar relatório
              </button>
              {run.validationType === "RECONCILIATION" ? (
                <ReconciliationResultsTable
                  results={run.results}
                  sources={run.participatingSources}
                  onReview={handleReview}
                />
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <FileCheck2 className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="mt-3 text-base font-bold text-slate-950">Checklist aguardando processamento</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Adicione documentos de ao menos duas fontes distintas para gerar a conferência.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "success" | "danger" | "warning" }) {
  const toneClasses = {
    neutral: "text-slate-950 bg-slate-100",
    success: "text-emerald-700 bg-emerald-50",
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

function ReviewProgress({ run }: { run: ReconciliationRun }) {
  const pendingResults = run.results.filter((result) => result.status !== "MATCH");
  const reviewed = pendingResults.filter((result) => result.humanReview?.status === "APPROVED").length;
  const unresolved = pendingResults.length - reviewed;
  const finalChecked = run.summary.matches + reviewed;
  const progress = run.summary.totalChecked
    ? Math.round((finalChecked / run.summary.totalChecked) * 100)
    : 0;

  return (
    <section className={`border p-5 ${unresolved === 0 ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${unresolved === 0 ? "text-emerald-600" : "text-[#2563eb]"}`} />
            <h2 className="text-sm font-bold text-slate-950">
              {unresolved === 0 ? "Processo totalmente conferido" : "Revisão humana do processo"}
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {unresolved === 0
              ? "Todos os campos foram conferidos automaticamente ou validados por um analista."
              : `${reviewed} itens validados manualmente · ${unresolved} pendências restantes`}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl font-bold text-slate-950">{progress}%</div>
          <div className="text-xs font-semibold text-slate-500">conferido</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${unresolved === 0 ? "bg-emerald-500" : "bg-[#2563eb]"}`} style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

function ProcessingPanel({
  steps,
  elapsedSeconds,
  documentCount,
}: {
  steps: Array<{ icon: typeof FileSearch; label: string; threshold: number }>;
  elapsedSeconds: number;
  documentCount: number;
}) {
  const activeIndex = Math.min(
    steps.length - 1,
    steps.findLastIndex((step) => elapsedSeconds >= step.threshold),
  );
  const progress = Math.min(92, 12 + elapsedSeconds * 0.55);

  return (
    <section className="border border-blue-200 bg-blue-50/50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <Loader2 className="h-4 w-4 animate-spin text-[#2563eb]" />
            Conferência em andamento
          </div>
          <p className="mt-1 text-sm text-slate-600">{documentCount} documentos em processamento · {formatElapsed(elapsedSeconds)}</p>
        </div>
        <span className="text-xs font-semibold text-slate-500">Não feche esta página</span>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-blue-100">
        <div className="h-full rounded-full bg-[#2563eb] transition-all duration-1000" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {steps.map((step, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <div key={step.label} className="flex items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isComplete || isActive ? "bg-[#2563eb] text-white" : "bg-white text-slate-400"}`}>
                {isComplete ? <Check className="h-4 w-4" /> : <step.icon className={`h-4 w-4 ${isActive ? "animate-pulse" : ""}`} />}
              </span>
              <span className={`text-xs font-semibold leading-4 ${isActive ? "text-slate-950" : "text-slate-500"}`}>{step.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">A etapa exibida é uma estimativa baseada no tempo de processamento. Documentos extensos podem levar alguns minutos.</p>
    </section>
  );
}

function ProcessError({ message }: { message?: string }) {
  return (
    <div className="flex items-start gap-3 border border-rose-200 bg-rose-50 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
      <div>
        <div className="text-sm font-bold text-rose-950">Não foi possível concluir a conferência</div>
        <div className="mt-1 text-sm text-rose-700">{message ?? "Tente novamente em alguns instantes."}</div>
      </div>
    </div>
  );
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes ? `${minutes}min ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function reviewStorageKey(runId: string) {
  return `conferia:reviews:${runId}`;
}

function finalResultCounts(run: ValidationRun) {
  if (run.validationType !== "RECONCILIATION") {
    return {
      checked: run.summary.matches,
      divergences: run.summary.divergences,
      reviews: run.summary.reviewRequired,
    };
  }

  return run.results.reduce(
    (counts, result) => {
      if (result.status === "MATCH" || result.humanReview?.status === "APPROVED") counts.checked += 1;
      else if (result.status === "DIVERGENCE") counts.divergences += 1;
      else counts.reviews += 1;
      return counts;
    },
    { checked: 0, divergences: 0, reviews: 0 },
  );
}
