"use client";

import { FileText, ImageIcon, Paperclip, Clipboard } from "lucide-react";
import type { UploadedDocument, ValidationType } from "@/domain/validation";
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
      file,
    }));

    onDocumentsChange([...documents, ...nextDocuments]);
  }

  function removeDocument(id: string) {
    onDocumentsChange(documents.filter((document) => document.id !== id));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Entradas do processo</h2>
          <p className="mt-1 text-sm text-slate-500">{acceptedCopy[validationType]}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600" title="Colar print">
          <Clipboard className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-teal-600 hover:bg-teal-50">
        <input
          className="sr-only"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <Paperclip className="h-8 w-8 text-teal-700" aria-hidden="true" />
        <span className="mt-3 text-sm font-semibold text-slate-900">Adicionar documentos</span>
        <span className="mt-1 max-w-sm text-xs text-slate-500">Use upload ou cole um print com Ctrl+V quando estiver na área da plataforma.</span>
      </label>

      <div className="mt-4 space-y-2">
        {documents.map((document) => (
          <div key={document.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              {document.mimeType.includes("image") ? <ImageIcon className="h-4 w-4 text-teal-700" /> : <FileText className="h-4 w-4 text-teal-700" />}
              <span className="truncate text-sm font-medium text-slate-800">{document.name}</span>
            </div>
            <button className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={() => removeDocument(document.id)}>
              Remover
            </button>
          </div>
        ))}
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
