"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, FileUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { Development, DevelopmentExtraction } from "@/domain/development";
import { reviewDevelopmentExtraction, unitTypeSignature } from "@/domain/development";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_SELECTED_PAGES = 40;

export function DevelopmentRegistry({ canManage }: { canManage: boolean }) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [extraction, setExtraction] = useState<DevelopmentExtraction | null>(null);
  const [sourceDocumentName, setSourceDocumentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageSelection, setPageSelection] = useState("");
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
    setBusy(true);
    setError("");
    try {
      const count = await getPdfPageCount(file);
      setPendingFile(file);
      setPageCount(count);
      setPageSelection(`1-${count}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível ler a quantidade de páginas da matrícula.");
    } finally {
      setBusy(false);
    }
  }

  async function extractSelectedPages() {
    if (!pendingFile) return;
    let selectedPages: number[];
    try {
      selectedPages = parsePageSelection(pageSelection, pageCount);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Selecione páginas válidas para extrair.");
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 295_000);
    setBusy(true);
    setError("");
    try {
      const pages = await renderPdfInBrowser(pendingFile, selectedPages);
      const imagePaths = await uploadRenderedPages(pendingFile.name, pages, controller.signal);
      const response = await fetch("/api/developments/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDocumentName: pendingFile.name, imagePaths, pageNumbers: selectedPages }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível extrair a matrícula.");
        return;
      }
      setExtraction(payload.extraction);
      setSourceDocumentName(payload.sourceDocumentName);
      setPendingFile(null);
    } catch (reason) {
      const aborted = reason instanceof DOMException && reason.name === "AbortError";
      setError(aborted
          ? "A extração ultrapassou o limite de 5 minutos. O PDF pode ser escaneado ou ter muitas páginas; tente novamente ou cadastre manualmente."
        : reason instanceof Error
          ? reason.message
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
          <p className="mt-1 text-sm text-slate-500">Envie a matrícula mestre. A IA lista torre, apartamento, áreas e fração ideal; revise antes de salvar. Você pode escolher apenas as páginas relevantes.</p>
          <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {busy ? "Preparando..." : "Selecionar matrícula"}
            <input className="sr-only" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => void handleFile(event.target.files?.[0])} />
          </label>
          {pendingFile ? (
            <div className="mt-4 border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <label className="flex-1 text-xs font-bold text-slate-700">
                  Páginas para extrair ({pageCount} no arquivo)
                  <input
                    className="mt-1 block min-h-10 w-full rounded-md border border-blue-300 bg-white px-3 text-sm font-medium text-slate-900"
                    value={pageSelection}
                    onChange={(event) => setPageSelection(event.target.value)}
                    placeholder="Ex.: 1-3, 8, 12-14"
                    disabled={busy}
                  />
                </label>
                <div className="flex gap-2">
                  <button className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700" disabled={busy} onClick={() => setPendingFile(null)}>Cancelar</button>
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => void extractSelectedPages()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Extrair páginas
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Use intervalos separados por vírgula. Todas as páginas ficam selecionadas por padrão; a seleção pode ter no máximo {MAX_SELECTED_PAGES} páginas.</p>
            </div>
          ) : null}
          <button
            className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setSourceDocumentName("Cadastro manual");
              setExtraction({ name: "", units: [{ tower: "", unit: "", privateArea: "", totalArea: "", idealFraction: "", confidence: 100 }] });
            }}
          >
            <Plus className="h-4 w-4" /> Criar manualmente
          </button>
          {busy ? <p className="mt-3 text-sm font-semibold text-slate-500">Analisando todas as páginas da matrícula. PDFs escaneados podem levar alguns minutos porque cada página passa por OCR.</p> : null}
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
            {extraction.quality?.reviewRequired.length ? (
              <div className="mb-5 border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
                <div className="font-bold">Revisão direcionada necessária</div>
                <p className="mt-1">A extração não será aceita automaticamente enquanto houver ambiguidade entre as leituras.</p>
                <ul className="mt-2 list-disc pl-5">
                  {extraction.quality.reviewRequired.slice(0, 12).map((item) => <li key={item}>{item}</li>)}
                </ul>
                {extraction.quality.reviewRequired.length > 12 ? <p className="mt-2 text-xs font-semibold">+ {extraction.quality.reviewRequired.length - 12} apontamentos adicionais.</p> : null}
              </div>
            ) : null}
            {extraction.quality?.warnings.length ? (
              <div className="mb-5 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {extraction.quality.warnings.join(" ")}
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
                  <tr><th className="py-3">Tipo</th><th>Torre</th><th>Unidade</th><th>Área privativa</th><th>Área total</th><th>Fração ideal</th><th>Confiança</th><th /></tr>
                </thead>
                <tbody>
                  {extraction.units.map((unit, index) => (
                    <tr key={`${unit.tower}-${unit.unit}-${index}`} className="border-b border-slate-100">
                      {(["typology", "tower", "unit", "privateArea", "totalArea", "idealFraction"] as const).map((key) => (
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

async function getPdfPageCount(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const count = document.numPages;
  await document.destroy();
  return count;
}

async function renderPdfInBrowser(file: File, selectedPages: number[]) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const images: Blob[] = [];

  try {
    for (const pageNumber of selectedPages) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a renderização do PDF no navegador.");
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(await canvasToJpegBlob(canvas));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  return images;
}

function parsePageSelection(value: string, pageCount: number) {
  const pages = new Set<number>();
  for (const token of value.split(",").map((part) => part.trim()).filter(Boolean)) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < start || end > pageCount) throw new Error(`Intervalo inválido: ${token}. Use páginas entre 1 e ${pageCount}.`);
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }
    if (!/^\d+$/.test(token)) throw new Error(`Página inválida: ${token}. Use exemplos como 1-3, 8 ou 12-14.`);
    const page = Number(token);
    if (page < 1 || page > pageCount) throw new Error(`Página inválida: ${page}. Use páginas entre 1 e ${pageCount}.`);
    pages.add(page);
  }
  const selected = [...pages].sort((left, right) => left - right);
  if (!selected.length) throw new Error("Selecione ao menos uma página para extrair.");
  if (selected.length > MAX_SELECTED_PAGES) throw new Error(`Selecione no máximo ${MAX_SELECTED_PAGES} páginas por extração.`);
  return selected;
}

async function uploadRenderedPages(fileName: string, pages: Blob[], signal: AbortSignal) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase não configurado para upload das páginas renderizadas.");
  const paths: string[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const uploadResponse = await fetch("/api/developments/extract/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: `${fileName.replace(/\.pdf$/i, "")}-pagina-${index + 1}.jpg`,
        fileSize: page.size,
        mimeType: "image/jpeg",
      }),
      signal,
    });
    const uploadPayload = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) throw new Error(uploadPayload.error ?? "Não foi possível preparar upload da página renderizada.");
    const { error } = await supabase.storage
      .from("process-documents")
      .uploadToSignedUrl(uploadPayload.storagePath, uploadPayload.token, page);
    if (error) throw new Error(`Não foi possível enviar página renderizada: ${error.message}`);
    paths.push(uploadPayload.storagePath);
  }

  return paths;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível converter a página renderizada em imagem."));
    }, "image/jpeg", 0.78);
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
  return key === "typology" || key === "privateArea";
}
