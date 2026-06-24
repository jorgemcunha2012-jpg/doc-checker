"use client";

import { FileText, ImageIcon, Paperclip, Clipboard, X } from "lucide-react";
import { activeDocumentSources, documentSourceLabels, type DocumentSource, type UploadedDocument, type ValidationType } from "@/domain/validation";
import { defaultOrganization } from "@/domain/tenant";

export type ClientUploadedDocument = UploadedDocument & {
  file: File;
};

type FileDropZoneProps = {
  validationType: ValidationType;
  documents: ClientUploadedDocument[];
  onDocumentsChange: (documents: ClientUploadedDocument[]) => void;
};

const acceptedCopy: Record<ValidationType, string> = {
  MINUTA: "Print, JPG, PNG ou PDF do contrato",
  ITBI: "Guia DTI/ITBI, contrato e complementares",
  RECONCILIATION: "Envie os documentos; a fonte será identificada automaticamente e poderá ser corrigida",
};

export function FileDropZone({ validationType, documents, onDocumentsChange }: FileDropZoneProps) {
  function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const nextDocuments = Array.from(files).map<ClientUploadedDocument>((file) => ({
      id: crypto.randomUUID(),
      organizationId: defaultOrganization.id,
      name: file.name,
      type: resolveDocumentType(file, validationType),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      source: validationType === "RECONCILIATION" ? inferDocumentSource(file) : undefined,
      file,
    }));

    onDocumentsChange([...documents, ...nextDocuments]);
  }

  function removeDocument(id: string) {
    onDocumentsChange(documents.filter((document) => document.id !== id));
  }

  function updateDocumentSource(id: string, source: DocumentSource) {
    onDocumentsChange(documents.map((document) => (document.id === id ? { ...document, source } : document)));
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="h-1 bg-gradient-to-r from-teal-700 via-slate-800 to-amber-500" />
      <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">Entradas do processo</h2>
          <p className="mt-1 text-sm text-slate-500">{acceptedCopy[validationType]}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600 shadow-inner" title="Colar print">
          <Clipboard className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-[linear-gradient(180deg,#f8fafc,#ffffff)] px-4 py-6 text-center transition hover:border-teal-600 hover:bg-teal-50">
        <input
          className="sr-only"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm">
          <Paperclip className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="mt-3 text-sm font-semibold text-slate-900">Adicionar documentos</span>
        <span className="mt-1 max-w-sm text-xs text-slate-500">Use upload ou cole um print com Ctrl+V quando estiver na área da plataforma.</span>
      </label>

      <div className="mt-4 space-y-2">
        {documents.map((document) => (
          <div key={document.id} className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-teal-700 shadow-sm">
                {document.mimeType.includes("image") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <span className="truncate text-sm font-medium text-slate-800">{document.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {validationType === "RECONCILIATION" ? (
                <select
                  aria-label={`Fonte de ${document.name}`}
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-teal-700"
                  value={document.source ?? "SIOPI"}
                  onChange={(event) => updateDocumentSource(document.id, event.target.value as DocumentSource)}
                >
                  {activeDocumentSources.map((source) => (
                    <option key={source} value={source}>
                      {documentSourceLabels[source]}
                    </option>
                  ))}
                </select>
              ) : null}
              <button className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-900" onClick={() => removeDocument(document.id)} title="Remover">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}

function resolveDocumentType(file: File, validationType: ValidationType): UploadedDocument["type"] {
  if (validationType === "ITBI" && /itbi|dti|guia/i.test(file.name)) {
    return "ITBI_GUIDE";
  }

  if (file.type.includes("image")) {
    return "IMAGE";
  }

  if (file.type.includes("pdf")) {
    return "PDF";
  }

  return validationType === "ITBI" ? "COMPLEMENTARY" : "CONTRACT";
}

function inferDocumentSource(file: File): DocumentSource {
  if (/itbi|dti|guia/i.test(file.name)) return "ITBI";
  if (/minuta|contrato|instrumento/i.test(file.name)) return "MINUTA";
  if (/siopi|espelho.*proposta|concess[aã]o/i.test(file.name)) return "SIOPI";
  if (/reserva|outlook/i.test(file.name) || file.type.includes("image")) return "DADOS_RESERVA";
  return "SIOPI";
}
