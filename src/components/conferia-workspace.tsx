"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Building2, Check, CheckCircle2, Clock3, Download, FileCheck2, FilePlus2, FileSearch, Layers3, Loader2, ScanText, ShieldCheck, Sparkles, UploadCloud, UsersRound } from "lucide-react";
import type { HumanReview, ReconciliationRun, User, ValidationProcess, ValidationRun } from "@/domain/validation";
import { documentSourceLabels } from "@/domain/validation";
import { defaultOrganization } from "@/domain/tenant";
import { ClientUploadedDocument, FileDropZone } from "./file-drop-zone";
import { ReconciliationResultsTable } from "./reconciliation-results-table";
import { LogoutButton } from "./logout-button";
import Link from "next/link";
import type { Development } from "@/domain/development";
import { ExtractionQualityPanel } from "./extraction-quality-panel";
import { InfoTooltip } from "./info-tooltip";

const validationType = "RECONCILIATION" as const;
const usesPersistentReviews = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export function ConferiaWorkspace({ currentUser, publicAccess = false, embedded = false }: { currentUser: User; publicAccess?: boolean; embedded?: boolean }) {
  const [documents, setDocuments] = useState<ClientUploadedDocument[]>([]);
  const [processId, setProcessId] = useState<string | null>(null);
  const [process, setProcess] = useState<ValidationProcess | null>(null);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [developmentId, setDevelopmentId] = useState("");
  const [developmentUnitId, setDevelopmentUnitId] = useState("");
  const [reportFilter, setReportFilter] = useState<"ALL" | "DIVERGENCES" | "PENDING" | "CHECKED">("ALL");
  const recoveryRequestedFor = useRef<string | null>(null);

  useEffect(() => {
    void fetch("/api/developments")
      .then((response) => response.ok ? response.json() : { developments: [] })
      .then((payload) => setDevelopments(payload.developments ?? []));
  }, []);

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
    if (!processingStartedAt || (!isSubmitting && !processId)) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - processingStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSubmitting, processId, processingStartedAt]);

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

      const isStale =
        (nextProcess.status === "PENDING" || nextProcess.status === "EXTRACTING") &&
        Date.now() - new Date(nextProcess.updatedAt).getTime() > 45_000;
      if (isStale && recoveryRequestedFor.current !== processId) {
        recoveryRequestedFor.current = processId;
        void fetch(`/api/validation-processes/${processId}/resume`, { method: "POST" });
      }

      if (nextProcess.status === "DONE") {
        setRun(nextProcess.result ?? null);
        setProcessId(null);
        setProcessingStartedAt(null);
        window.clearInterval(interval);
      }

      if (nextProcess.status === "FAILED") {
        setProcessingStartedAt(null);
        window.clearInterval(interval);
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [processId]);

  const selectedDevelopment = developments.find((development) => development.id === developmentId);
  const hasDocuments =
    new Set(documents.map((document) => document.source).filter(Boolean)).size + (developmentUnitId ? 1 : 0) >= 2;
  const sourceCount = new Set(documents.map((document) => document.source).filter(Boolean)).size;
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
    recoveryRequestedFor.current = null;

    const formData = new FormData();
    formData.set("validationType", validationType);
    documents.forEach((document) => formData.append("documents", document.file, document.name));
    formData.set("documentSources", JSON.stringify(documents.map((document) => document.source ?? "SIOPI")));
    if (developmentUnitId) formData.set("developmentUnitId", developmentUnitId);

    const response = await fetch("/api/validation-processes", {
      method: "POST",
      body: formData,
    });
    const payload = await readJsonSafely<{ processId?: string; process?: ValidationProcess; error?: string }>(response);
    setIsSubmitting(false);

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
      setProcessingStartedAt(null);
      return;
    }

    if (payload.process) {
      setProcess(payload.process);
    }

    if (payload.process?.status === "DONE") {
      setRun(payload.process.result ?? null);
      setProcessId(null);
      setProcessingStartedAt(null);
      return;
    }

    if (payload.process?.status === "FAILED") {
      setProcessId(null);
      setProcessingStartedAt(null);
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
      body: JSON.stringify({ run, filter: reportFilter }),
    });

    if (!response.ok) {
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conferia-${run.id}-${reportFilter.toLowerCase()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleNewValidation() {
    setDocuments([]);
    setProcessId(null);
    setProcess(null);
    setRun(null);
    setIsSubmitting(false);
    setProcessingStartedAt(null);
    setElapsedSeconds(0);
    setDevelopmentId("");
    setDevelopmentUnitId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleReview(fieldId: string, review?: HumanReview) {
    if (usesPersistentReviews && run?.validationType === "RECONCILIATION") {
      const url = `/api/processes/${run.id}/review${review ? "" : `?fieldId=${encodeURIComponent(fieldId)}`}`;
      const response = await fetch(url, {
        method: review ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: review ? JSON.stringify({ fieldId, justification: review.justification }) : undefined,
      });
      if (response.ok && review) {
        const payload = await response.json();
        review = payload.review;
      }
    }
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
      if (!usesPersistentReviews) {
        window.localStorage.setItem(reviewStorageKey(next.id), JSON.stringify(reviews));
      }
      return next;
    });
  }

  return (
    <main className={embedded ? "" : "min-h-screen"}>
      {!embedded ? <header className="border-b border-slate-200 bg-white">
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
          {!publicAccess ? <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 sm:flex">
            {currentUser.role === "ADMIN" ? <Link href="/admin" className="text-blue-600">Painel administrativo</Link> : null}
            <Link href={{ pathname: "/history" }} className="text-blue-600">Histórico</Link>
            <span className="text-slate-300">|</span>
            {currentUser.name}
            <Link href="/change-password" className="text-blue-600">Alterar senha</Link>
            <a href="/developments" className="text-blue-600">Empreendimentos</a>
            <LogoutButton />
          </div> : null}
        </div>
      </header> : null}

      <section className={embedded ? "mb-7" : "border-b border-[var(--border)] bg-[var(--canvas)]"}>
        <div className="mx-auto max-w-7xl px-5 py-9 sm:py-12">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            <Sparkles className="h-4 w-4" />
            Checklist inteligente com IA
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-4xl">Prepare uma nova conferência</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">Escolha a referência do imóvel e organize os documentos por origem. A ConferIA identifica, extrai e compara os dados automaticamente.</p>
        </div>
      </section>

      <div className={`mx-auto max-w-7xl ${embedded ? "" : "px-5 py-8"}`}>
        <section className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">Dados para comparação</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">Conclua as duas etapas abaixo. Sem cadastro mestre, adicione documentos de pelo menos duas fontes.</p>
              </div>
            </div>
            <button
              className="app-button-primary hidden min-h-11 shrink-0 items-center justify-center gap-2 px-5 py-2 text-sm font-semibold lg:inline-flex"
              disabled={!hasDocuments || isProcessing}
              onClick={handleRunValidation}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Iniciar conferência
            </button>
          </div>

          <section className="app-card p-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Etapa 1</div>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Identificação do imóvel</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">Se houver uma unidade cadastrada, use-a como fonte de referência para áreas, fração ideal e matrícula.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-[var(--muted)]">Empreendimento
                <select className="app-input mt-1 block w-full px-3 text-sm" value={developmentId} onChange={(event) => { setDevelopmentId(event.target.value); setDevelopmentUnitId(""); }}>
                  <option value="">Sem cadastro mestre</option>
                  {developments.map((development) => <option key={development.id} value={development.id}>{development.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-[var(--muted)]">Tipo de unidade
                <select disabled={!selectedDevelopment} className="app-input mt-1 block w-full px-3 text-sm disabled:bg-slate-100" value={developmentUnitId} onChange={(event) => setDevelopmentUnitId(event.target.value)}>
                  <option value="">Selecione a unidade</option>
                  {selectedDevelopment?.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.typology || `Torre ${unit.tower} · Apto ${unit.unit}`} · {unit.privateArea} priv. · {unit.commonArea || "-"} comum · {unit.totalArea || "-"} total · fração {unit.idealFraction || "-"} · IPTU {unit.iptuRegistration || "-"}</option>)}
                </select>
              </label>
            </div>
            {currentUser.role === "ADMIN" ? (
              <a href="/developments" className="mt-4 inline-flex min-h-9 items-center text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]">
                Cadastrar nova base de empreendimento
              </a>
            ) : null}
          </section>

          <FileDropZone
            validationType={validationType}
            documents={documents}
            onDocumentsChange={setDocuments}
            title="Etapa 2 · Documentos do comprador"
            description="Envie telas, minuta, ITBI, matrícula, certidões e demais documentos específicos desta conferência."
          />
          {documents.length ? <AnalysisEstimate documents={documents} /> : null}

          {!isProcessing && !run ? (
            <div className="sticky bottom-4 z-20 rounded-2xl border border-[var(--border)] bg-white/95 p-3 shadow-[0_18px_50px_rgb(16_42_58/0.18)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
              <div className="mb-3 sm:mb-0">
                <div className="text-sm font-semibold text-[var(--foreground)]">{hasDocuments ? "Tudo pronto para conferir" : "Complete as fontes da conferência"}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{hasDocuments ? `${documents.length} arquivo(s) em ${sourceCount} fonte(s)${developmentUnitId ? " e uma unidade de referência" : ""}.` : developmentUnitId ? "Adicione ao menos uma fonte documental." : "Adicione documentos de pelo menos duas fontes diferentes."}</div>
              </div>
              <button className="app-button-primary inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 px-5 text-sm font-semibold sm:w-auto" disabled={!hasDocuments} onClick={handleRunValidation}>
                <UploadCloud className="h-4 w-4" /> Iniciar conferência
              </button>
            </div>
          ) : null}

          {isProcessing ? <ProcessingPanel steps={processSteps} elapsedSeconds={elapsedSeconds} documents={documents} /> : null}
          {process?.status === "FAILED" ? <ProcessError message={process.error} /> : null}

          {run ? (
            <>
              {run.validationType === "RECONCILIATION" ? <ReviewProgress run={run} /> : null}
              {run.validationType === "RECONCILIATION" ? <ParticipantSummary run={run} /> : null}
              {run.usedPdfVisionFallback ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="text-sm font-bold">
                      {run.validationType === "RECONCILIATION" ? "OCR aplicado em PDF escaneado" : "Fallback de visão utilizado"}
                    </div>
                    {run.validationType === "RECONCILIATION" ? <ExtractionMethodNotice run={run} /> : (
                      <div className="mt-1 text-sm">O PDF tinha pouco ou nenhum texto extraível e exigiu análise visual.</div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className={`grid gap-3 ${run.validationType === "RECONCILIATION" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
                <SummaryCard label="Total de campos conferidos" value={run.summary.totalChecked} tone="neutral" hint="Quantidade de linhas do checklist que entraram na comparação entre as fontes participantes." />
                <SummaryCard label="Campos conferidos" value={finalResultCounts(run).checked} tone="success" hint="Campos com valores equivalentes ou aprovados manualmente por um usuário." />
                <SummaryCard label="Divergências pendentes" value={finalResultCounts(run).divergences} tone="danger" hint="Campos em que a engine encontrou uma diferença relevante e ainda não houve validação humana." />
                <SummaryCard label="Revisões pendentes" value={finalResultCounts(run).reviews} tone="warning" hint="Campos que precisam de análise humana por ausência, baixa confiança, conflito ou resultado inconclusivo." />
                {run.validationType === "RECONCILIATION" ? (
                  <SummaryCard label="Campos em fonte ilegível" value={run.summary.unreadable} tone="warning" hint="Campos afetados por uma fonte enviada que não pôde ser interpretada com segurança." />
                ) : null}
              </div>
              {run.validationType === "RECONCILIATION" ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {run.participatingSources.map((source) => (
                    <div key={source} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-1 text-xs font-bold uppercase text-slate-500">{documentSourceLabels[source]} <InfoTooltip text="Fonte documental usada na reconciliação. Os números abaixo se referem somente aos campos esperados nesta fonte." /></div>
                      <div className="mt-2 text-sm text-slate-700">
                        {run.summary.missingBySource[source] ?? 0} ausentes · {run.summary.unreadableBySource[source] ?? 0} ilegíveis
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                  onClick={handleNewValidation}
                >
                  <FilePlus2 className="h-4 w-4" />
                  Nova conferência
                </button>
                <select
                  aria-label="Filtro do relatório"
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
                  value={reportFilter}
                  onChange={(event) => setReportFilter(event.target.value as typeof reportFilter)}
                >
                  <option value="ALL">Relatório completo</option>
                  <option value="DIVERGENCES">Somente divergências pendentes</option>
                  <option value="PENDING">Todas as pendências</option>
                  <option value="CHECKED">Somente itens conferidos</option>
                </select>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  onClick={handleExportReport}
                >
                  <Download className="h-4 w-4" />
                  Exportar relatório
                </button>
              </div>
              {run.validationType === "RECONCILIATION" ? (
                <>
                  <ExtractionQualityPanel reports={run.extractionQualityBySource} checklist={run.checklist} />
                  <ReconciliationResultsTable
                    results={run.results}
                    sources={run.participatingSources}
                    onReview={handleReview}
                    reviewer={currentUser}
                  />
                </>
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

function SummaryCard({ label, value, tone, hint }: { label: string; value: number; tone: "neutral" | "success" | "danger" | "warning"; hint: string }) {
  const toneClasses = {
    neutral: "text-slate-950 bg-slate-100",
    success: "text-emerald-700 bg-emerald-50",
    danger: "text-rose-700 bg-rose-50",
    warning: "text-amber-700 bg-amber-50",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex h-9 min-w-12 items-center justify-center rounded-md px-3 text-lg font-bold ${toneClasses[tone]}`}>{value}</div>
      <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-slate-700">{label} <InfoTooltip text={hint} /></div>
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
          <div className="flex items-center justify-end gap-1"><div className="text-2xl font-bold text-slate-950">{progress}%</div> <InfoTooltip text="Percentual do checklist que já está conferido automaticamente ou validado manualmente. Divergências e revisões ainda abertas ficam fora deste percentual." /></div>
          <div className="text-xs font-semibold text-slate-500">conferido</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${unresolved === 0 ? "bg-emerald-500" : "bg-[#2563eb]"}`} style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

function ParticipantSummary({ run }: { run: ReconciliationRun }) {
  const participants = Array.from(
    new Map(
      run.results
        .filter((result) => result.field.participantId)
        .map((result) => [result.field.participantId, result.field.participantLabel ?? "Comprador"]),
    ).values(),
  );
  if (!participants.length) return null;
  return (
    <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 px-4 py-3">
      <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
      <div>
        <div className="text-sm font-bold text-slate-900">
          {participants.length} {participants.length === 1 ? "comprador identificado" : "compradores identificados"}
        </div>
        <div className="mt-1 text-xs text-slate-600">{participants.join(" · ")}</div>
      </div>
    </div>
  );
}

function ProcessingPanel({
  steps,
  elapsedSeconds,
  documents,
}: {
  steps: Array<{ icon: typeof FileSearch; label: string; threshold: number }>;
  elapsedSeconds: number;
  documents: ClientUploadedDocument[];
}) {
  const estimate = estimateAnalysis(documents);
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
          <p className="mt-1 text-sm text-slate-600">{documents.length} documentos em processamento · {formatElapsed(elapsedSeconds)}</p>
          <p className="mt-1 text-xs font-semibold text-blue-700">Tempo estimado: {estimate.label}</p>
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
      <p className="mt-4 text-xs text-slate-500">
        {elapsedSeconds > estimate.maxSeconds
          ? "O processamento ultrapassou a estimativa. Isso pode acontecer quando um PDF é escaneado, muito extenso ou exige nova tentativa de leitura."
          : "A etapa e o prazo são estimativas. O tempo pode variar conforme legibilidade, quantidade de páginas e resposta dos provedores de IA."}
      </p>
    </section>
  );
}

function AnalysisEstimate({ documents }: { documents: ClientUploadedDocument[] }) {
  const estimate = estimateAnalysis(documents);
  return (
    <div className="flex items-start gap-3 border border-slate-200 bg-slate-50 px-4 py-3">
      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
      <div>
        <div className="text-sm font-bold text-slate-800">Estimativa para estes arquivos: {estimate.label}</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          PDFs com texto interno são processados mais rapidamente. PDFs escaneados precisam de leitura visual/OCR e podem levar alguns minutos.
        </p>
      </div>
    </div>
  );
}

function estimateAnalysis(documents: ClientUploadedDocument[]) {
  const pdfs = documents.filter((document) => document.mimeType.includes("pdf") || document.name.toLowerCase().endsWith(".pdf"));
  const images = documents.length - pdfs.length;
  const hasLargePdf = pdfs.some((document) => (document.sizeBytes ?? 0) >= 3 * 1024 * 1024);

  if (hasLargePdf) return { label: "2 a 6 minutos", maxSeconds: 360 };
  if (pdfs.length && images) return { label: "1 a 3 minutos", maxSeconds: 180 };
  if (pdfs.length) return { label: "40 segundos a 2 minutos", maxSeconds: 120 };
  return { label: images > 2 ? "1 a 3 minutos" : "30 segundos a 2 minutos", maxSeconds: images > 2 ? 180 : 120 };
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

function ExtractionMethodNotice({ run }: { run: Extract<ValidationRun, { validationType: "RECONCILIATION" }> }) {
  const reports = Object.values(run.extractionQualityBySource ?? {}).filter(Boolean);
  const ocrReports = reports.filter((report) => report.extractionMethod === "OCR" || report.extractionMethod === "MIXED");
  const failedReports = reports.filter((report) => report.status === "FAILED" && report.error);

  if (failedReports.length) {
    return (
      <div className="mt-1 space-y-1 text-sm">
        {failedReports.map((report) => (
          <div key={report.source}>
            {documentSourceLabels[report.source]}: {report.error}
          </div>
        ))}
      </div>
    );
  }

  if (ocrReports.length) {
    return (
      <div className="mt-1 text-sm">
        {ocrReports.map((report) => documentSourceLabels[report.source]).join(", ")} exigiu OCR porque o PDF tinha pouco ou nenhum texto selecionável.
      </div>
    );
  }

  return <div className="mt-1 text-sm">Um PDF tinha pouco ou nenhum texto extraível e exigiu análise visual.</div>;
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
