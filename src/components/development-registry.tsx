"use client";

import { useEffect, useState } from "react";
import { Building2, FileUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { Development, DevelopmentExtraction } from "@/domain/development";

export function DevelopmentRegistry({ canManage }: { canManage: boolean }) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [extraction, setExtraction] = useState<DevelopmentExtraction | null>(null);
  const [sourceDocumentName, setSourceDocumentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    const form = new FormData();
    form.set("document", file);
    const response = await fetch("/api/developments/extract", { method: "POST", body: form });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível extrair a matrícula.");
      return;
    }
    setExtraction(payload.extraction);
    setSourceDocumentName(payload.sourceDocumentName);
  }

  async function save() {
    if (!extraction) return;
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

  function updateUnit(index: number, key: "tower" | "unit" | "privateArea" | "typology", value: string) {
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
          <p className="mt-1 text-sm text-slate-500">Envie a matrícula mestre. A IA lista torre, apartamento e área; revise antes de salvar.</p>
          <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Extrair matrícula
            <input className="sr-only" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => void handleFile(event.target.files?.[0])} />
          </label>
          <button
            className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setSourceDocumentName("Cadastro manual");
              setExtraction({ name: "", units: [{ tower: "", unit: "", privateArea: "", confidence: 100 }] });
            }}
          >
            <Plus className="h-4 w-4" /> Criar manualmente
          </button>
          {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
        </section> : null}

        {canManage && extraction ? (
          <section className="border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <Field label="Empreendimento" value={extraction.name} onChange={(value) => setExtraction({ ...extraction, name: value })} />
                <Field label="Cidade" value={extraction.city ?? ""} onChange={(value) => setExtraction({ ...extraction, city: value })} />
                <Field label="Matrícula" value={extraction.registration ?? ""} onChange={(value) => setExtraction({ ...extraction, registration: value })} />
              </div>
              <button onClick={() => void save()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50">
                <Save className="h-4 w-4" /> Salvar cadastro
              </button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr><th className="py-3">Torre</th><th>Unidade</th><th>Área privativa</th><th>Tipologia</th><th>Confiança</th><th /></tr>
                </thead>
                <tbody>
                  {extraction.units.map((unit, index) => (
                    <tr key={`${unit.tower}-${unit.unit}-${index}`} className="border-b border-slate-100">
                      {(["tower", "unit", "privateArea", "typology"] as const).map((key) => (
                        <td key={key} className="py-2 pr-3">
                          <input className="w-full rounded border border-slate-300 px-2 py-1.5" value={unit[key] ?? ""} onChange={(event) => updateUnit(index, key, event.target.value)} />
                        </td>
                      ))}
                      <td>{unit.confidence}%</td>
                      <td><button title="Remover unidade" onClick={() => setExtraction({ ...extraction, units: extraction.units.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4 text-slate-400" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setExtraction({ ...extraction, units: [...extraction.units, { tower: "", unit: "", privateArea: "", confidence: 100 }] })} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600">
              <Plus className="h-4 w-4" /> Adicionar unidade
            </button>
          </section>
        ) : null}

        <section className="border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Empreendimentos cadastrados</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {developments.map((development) => (
              <div key={development.id} className="flex items-center justify-between gap-4 py-4">
                <div><div className="font-bold text-slate-900">{development.name}</div><div className="text-sm text-slate-500">{development.city ?? "Cidade não informada"} · Matrícula {development.registration ?? "não informada"}</div></div>
                <div className="text-sm font-semibold text-slate-600">{development.units.length} unidades</div>
              </div>
            ))}
            {!developments.length ? <p className="py-8 text-center text-sm text-slate-500">Nenhum empreendimento cadastrado.</p> : null}
          </div>
        </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-slate-600">{label}<input className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-900" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
