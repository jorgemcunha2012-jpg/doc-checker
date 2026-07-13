"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, FileUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { Development, DevelopmentExtraction } from "@/domain/development";
import { reviewDevelopmentExtraction, unitTypeSignature } from "@/domain/development";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DIRECT_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

export function DevelopmentRegistry({ canManage }: { canManage: boolean }) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [extraction, setExtraction] = useState<DevelopmentExtraction | null>(null);
  const [sourceDocumentName, setSourceDocumentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const review = extraction ? reviewDevelopmentExtraction(extraction) : null;

  useEffect(() => {
    void loadDevelopments();
  }, []);

  async function loadDevelopments() {
    const response = await fetch("/api/developments");
    const payload = await response.json();
    if (response.ok) setDevelopments(payload.developments);
  }

  async function handleFile(file?: File) {
    if (!file) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 165_000);
    setBusy(true);
    setError("");
    try {
      const response = file.size > DIRECT_UPLOAD_LIMIT_BYTES
        ? await extractLargeFile(file, controller.signal)
        : await extractDirectFile(file, controller.signal);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(response.status === 413
          ? "O PDF ultrapassou o limite de envio direto da Vercel. Tente novamente: a ferramenta usará upload seguro pelo Storage."
          : payload.error ?? "Não foi possível extrair a matrícula.");
        return;
      }
      setExtraction(payload.extraction);
      setSourceDocumentName(payload.sourceDocumentName);
    } catch (reason) {
      const aborted = reason instanceof DOMException && reason.name === "AbortError";
      setError(aborted
        ? "A extração demorou demais. Cadastre manualmente ou envie uma versão menor com as páginas de tipos, áreas e frações."
        : "Não foi possível comunicar com o extrator. Tente novamente ou use o cadastro manual.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  async function save() {
    if (!extraction) return;
    const reviewResult = reviewDevelopmentExtraction(extraction);
    if (!reviewResult.canSave) {
      setError("Revise o nome do empreendimento e preencha torre, unidade e área privativa antes de salvar.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/developments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraction, sourceDocumentName }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível salvar o empreendimento.");
      return;
    }
    setExtraction(null);
    setSourceDocumentName("");
    await loadDevelopments();
  }

  function updateUnit(index: number, key: "tower" | "unit" | "privateArea" | "totalArea" | "idealFraction" | "typology", value: string) {
    if (!extraction) return;
    setExtraction({
      ...extraction,
      units: extraction.units.map((unit, unitIndex) => unitIndex === index ? { ...unit, [key]: value } : unit),
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-[#0faaa2]" />
        <div><h1 className="text-2xl font-bold text-slate-950">Empreendimentos</h1><p className="mt-1 text-sm text-slate-500">Base mestre utilizada nas conferências documentais.</p></div>
      </div>
        {canManage ? <section className="border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Novo empreendimento</h2>
          <p className="mt-1 text-sm text-slate-500">Envie a matrícula mestre. A IA lista torre, apartamento, áreas e fração ideal; revise antes de salvar. PDFs escaneados ou muito longos podem levar mais tempo.</p>
          <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {busy ? "Extraindo matrícula..." : "Extrair matrícula"}
            <input className="sr-only" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => void handleFile(event.target.files?.[0])} />
          </label>
          <button
            className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setSourceDocumentName("Cadastro manual");
              setExtraction({ name: "", units: [{ tower: "", unit: "", privateArea: "", totalArea: "", idealFraction: "", confidence: 100 }] });
            }}
          >
            <Plus className="h-4 w-4" /> Criar manualmente
          </button>
          {busy ? <p className="mt-3 text-sm font-semibold text-slate-500">Analisando a matrícula com imagens otimizadas. Se passar de 2 a 3 minutos, a tela encerrará a tentativa automaticamente.</p> : null}
          {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
        </section> : null}

        {canManage && extraction ? (
          <section className="border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-[#0f8f88]">Revisão obrigatória</div>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Revisar cadastro extraído</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Confira os tipos, torres, apartamentos, áreas e fração ideal antes de transformar a extração em base mestre.</p>
              </div>
              {review?.canSave ? (
                <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Pronto para salvar
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4" /> Revisão pendente
                </div>
              )}
            </div>
            {review ? (
              <div className="mb-5 grid gap-3 sm:grid-cols-5">
                <ReviewMetric label="Torres" value={review.towerCount} />
                <ReviewMetric label="Unidades" value={review.unitCount} />
                <ReviewMetric label="Tipos" value={review.typeCount} />
                <ReviewMetric label="Incompletas" value={review.incompleteUnits} alert={review.incompleteUnits > 0} />
                <ReviewMetric label="Baixa confiança" value={review.lowConfidenceUnits} alert={review.lowConfidenceUnits > 0} />
              </div>
            ) : null}
            {review && (!review.canSave || review.lowConfidenceUnits > 0) ? (
              <div className="mb-5 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Preencha os campos obrigatórios destacados. Área total e fração ideal podem ficar vazias se não constarem na matrícula, mas serão melhores para conferência quando informadas.
              </div>
            ) : null}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <Field label="Empreendimento" value={extraction.name} required invalid={!extraction.name.trim()} onChange={(value) => setExtraction({ ...extraction, name: value })} />
                <Field label="Cidade" value={extraction.city ?? ""} onChange={(value) => setExtraction({ ...extraction, city: value })} />
                <Field label="Matrícula" value={extraction.registration ?? ""} onChange={(value) => setExtraction({ ...extraction, registration: value })} />
              </div>
              <button onClick={() => void save()} disabled={busy || !review?.canSave} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" /> Salvar cadastro
              </button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr><th className="py-3">Torre</th><th>Unidade</th><th>Área privativa</th><th>Área total</th><th>Fração ideal</th><th>Tipo</th><th>Confiança</th><th /></tr>
                </thead>
                <tbody>
                  {extraction.units.map((unit, index) => (
                    <tr key={`${unit.tower}-${unit.unit}-${index}`} className="border-b border-slate-100">
                      {(["tower", "unit", "privateArea", "totalArea", "idealFraction", "typology"] as const).map((key) => (
                        <td key={key} className="py-2 pr-3">
                          <input
                            className={`w-full rounded border px-2 py-1.5 ${isRequiredUnitField(key) && !String(unit[key] ?? "").trim() ? "border-amber-400 bg-amber-50" : unit.confidence < 80 ? "border-amber-200 bg-amber-50/50" : "border-slate-300"}`}
                            value={unit[key] ?? ""}
                            onChange={(event) => updateUnit(index, key, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className={unit.confidence < 80 ? "font-bold text-amber-700" : "text-slate-700"}>{unit.confidence}%</td>
                      <td><button title="Remover unidade" onClick={() => setExtraction({ ...extraction, units: extraction.units.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4 text-slate-400" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...new Set(extraction.units.map(unitTypeSignature))].map((signature, index) => (
                <span key={signature} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                  Tipo {index + 1}: {signature.split("::").slice(1).join(" · ")}
                </span>
              ))}
            </div>
            <button onClick={() => setExtraction({ ...extraction, units: [...extraction.units, { tower: "", unit: "", privateArea: "", totalArea: "", idealFraction: "", confidence: 100 }] })} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600">
              <Plus className="h-4 w-4" /> Adicionar unidade
            </button>
          </section>
        ) : null}

        <section className="border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Empreendimentos cadastrados</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {developments.map((development) => (
              <div key={development.id} className="flex items-center justify-between gap-4 py-4">
                <div><div className="font-bold text-slate-900">{development.name}</div><div className="text-sm text-slate-500">{development.city ?? "Cidade não informada"} · Matrícula {development.registration ?? "não informada"}</div><div className="mt-1 text-xs text-slate-500">{summarizeUnitTypes(development)}</div></div>
                <div className="text-sm font-semibold text-slate-600">{development.units.length} unidades</div>
              </div>
            ))}
            {!developments.length ? <p className="py-8 text-center text-sm text-slate-500">Nenhum empreendimento cadastrado.</p> : null}
          </div>
        </section>
    </div>
  );
}

async function extractDirectFile(file: File, signal: AbortSignal) {
  const form = new FormData();
  form.set("document", file);
  return fetch("/api/developments/extract", {
    method: "POST",
    body: form,
    signal,
  });
}

async function extractLargeFile(file: File, signal: AbortSignal) {
  const uploadResponse = await fetch("/api/developments/extract/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type || "application/pdf" }),
    signal,
  });
  const uploadPayload = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    return new Response(JSON.stringify(uploadPayload), {
      status: uploadResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase não configurado para upload de arquivos grandes." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { error } = await supabase.storage
    .from("process-documents")
    .uploadToSignedUrl(uploadPayload.storagePath, uploadPayload.token, file);
  if (error) {
    return new Response(JSON.stringify({ error: `Não foi possível enviar a matrícula ao Storage: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return fetch("/api/developments/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storagePath: uploadPayload.storagePath, sourceDocumentName: file.name }),
    signal,
  });
}

function summarizeUnitTypes(development: Development) {
  const signatures = new Set(development.units.map((unit) =>
    `${unit.privateArea || "-"} priv. · ${unit.totalArea || "-"} total · fração ${unit.idealFraction || "-"}`,
  ));
  return `${signatures.size} tipo(s) cadastrado(s)`;
}

function ReviewMetric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div className={`border p-3 ${alert ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><div className={`text-xl font-bold ${alert ? "text-amber-800" : "text-slate-950"}`}>{value}</div><div className={`text-xs font-semibold ${alert ? "text-amber-800" : "text-slate-500"}`}>{label}</div></div>;
}

function Field({ label, value, onChange, required = false, invalid = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; invalid?: boolean }) {
  return <label className="text-xs font-bold text-slate-600">{label}{required ? <span className="ml-1 text-amber-600">*</span> : null}<input className={`mt-1 block min-h-10 w-full rounded-md border px-3 text-sm font-medium text-slate-900 ${invalid ? "border-amber-400 bg-amber-50" : "border-slate-300"}`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function isRequiredUnitField(key: string) {
  return key === "tower" || key === "unit" || key === "privateArea";
}
