"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, CheckCircle2, Database, FileCheck2, FileSearch, Layers3, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import type { UploadedDocument, ValidationRun, ValidationType } from "@/domain/validation";
import { runValidation } from "@/services/validation/run-validation";
import { validationTypeCopy } from "@/lib/validation-copy";
import { FileDropZone } from "./file-drop-zone";
import { ResultsTable } from "./results-table";

const validationTypes: ValidationType[] = ["MINUTA", "ITBI"];

export function ConferiaWorkspace() {
  const [validationType, setValidationType] = useState<ValidationType>("MINUTA");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCopy = validationTypeCopy[validationType];

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const files = event.clipboardData?.files;
      if (!files?.length) {
        return;
      }

      const pastedDocuments = Array.from(files).map<UploadedDocument>((file, index) => ({
        id: crypto.randomUUID(),
        name: file.name || `print-colado-${index + 1}.png`,
        type: "PRINT",
        mimeType: file.type || "image/png",
      }));

      setDocuments((current) => [...current, ...pastedDocuments]);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    setDocuments([]);
    setRun(null);
  }, [validationType]);

  const hasDocuments = documents.length > 0;

  const processSteps = useMemo(
    () => [
      { icon: FileSearch, label: validationType === "MINUTA" ? "Extrair dados do print" : "Ler guia DTI/ITBI" },
      { icon: FileCheck2, label: "Extrair dados do contrato" },
      { icon: Layers3, label: "Comparar campos e regras" },
      { icon: CheckCircle2, label: "Gerar checklist auditável" },
    ],
    [validationType],
  );

  function handleRunValidation() {
    startTransition(async () => {
      const response = await runValidation(validationType, documents);
      setRun(response.validation);
    });
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
            <p className="mt-2 text-sm leading-6 text-slate-500">Selecione o fluxo documental e execute uma análise simulada com checklist configurável.</p>

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
                disabled={!hasDocuments || isPending}
                onClick={handleRunValidation}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Processar conferência
              </button>
            </div>
          </div>

          <FileDropZone validationType={validationType} documents={documents} onDocumentsChange={setDocuments} />

          {run ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard label="Total de campos conferidos" value={run.summary.totalChecked} tone="neutral" />
                <SummaryCard label="Total de divergências" value={run.summary.divergences} tone="danger" />
                <SummaryCard label="Total pendente de revisão" value={run.summary.reviewRequired} tone="warning" />
              </div>
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
