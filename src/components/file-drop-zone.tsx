"use client";

import { useEffect, useState } from "react";
import { FileText, ImageIcon, Paperclip, Clipboard, Eye, X } from "lucide-react";
import { uploadDocumentSources, documentSourceLabels, type DocumentSource, type UploadedDocument, type ValidationType } from "@/domain/validation";
import { defaultOrganization } from "@/domain/tenant";

export type ClientUploadedDocument = UploadedDocument & {
  file: File;
};

type FileDropZoneProps = {
  validationType: ValidationType;
  documents: ClientUploadedDocument[];
  onDocumentsChange: (documents: ClientUploadedDocument[]) => void;
  title?: string;
  description?: string;
};

export function FileDropZone({
  validationType,
  documents,
  onDocumentsChange,
  title = "Documentos do processo",
  description = "Envie os documentos que deseja verificar. Prints das telas, minuta e anexos podem ser combinados na mesma conferência.",
}: FileDropZoneProps) {
  const [previewDocument, setPreviewDocument] = useState<ClientUploadedDocument | null>(null);

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
    <section className="border border-slate-200 bg-white">
      <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-500" title="Também aceita Ctrl+V">
          <Clipboard className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center transition hover:border-[#2563eb] hover:bg-blue-50/50">
        <input
          className="sr-only"
          type="file"
          multiple
          accept=".pdf,.docx,.rtf,.tif,.tiff,.jpg,.jpeg,.png,image/jpeg,image/png,image/tiff,application/pdf,application/rtf,text/rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#2563eb] shadow-sm ring-1 ring-slate-200">
          <Paperclip className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="mt-3 text-sm font-semibold text-slate-900">Adicionar documentos para verificação</span>
        <span className="mt-1 max-w-sm text-xs text-slate-500">PDF, DOCX, RTF, TIFF/TIF, PNG ou JPG. Também é possível colar prints com Ctrl+V.</span>
      </label>

      <div className="mt-4 space-y-2">
        {documents.map((document) => (
          <div key={document.id} className="flex flex-col gap-2 border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[#2563eb]">
                {document.mimeType.includes("image") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <span className="truncate text-sm font-medium text-slate-800">{document.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label={`Fonte de ${document.name}`}
                className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-[#2563eb]"
                value={document.source ?? "SIOPI"}
                onChange={(event) => updateDocumentSource(document.id, event.target.value as DocumentSource)}
              >
                {uploadDocumentSources.map((source) => (
                  <option key={source} value={source}>
                    {documentSourceLabels[source]}
                  </option>
                ))}
              </select>
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => setPreviewDocument(document)}
                title="Visualizar documento"
                aria-label={`Visualizar ${document.name}`}
              >
                <Eye className="h-4 w-4" />
              </button>
              <button className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-900" onClick={() => removeDocument(document.id)} title="Remover">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
      {previewDocument ? <DocumentPreview document={previewDocument} onClose={() => setPreviewDocument(null)} /> : null}
    </section>
  );
}

function DocumentPreview({ document, onClose }: { document: ClientUploadedDocument; onClose: () => void }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(document.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [document.file]);

  const isTiff = document.mimeType === "image/tiff" || /\.tiff?$/i.test(document.name);
  const isDocx = document.mimeType.includes("wordprocessingml") || /\.docx$/i.test(document.name);
  const isImage = document.mimeType.includes("image") && !isTiff;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Visualização de ${document.name}`}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-t-lg bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-950">{document.name}</div>
          <div className="text-xs text-slate-500">{documentSourceLabels[document.source ?? "DOCUMENTO_COMPLEMENTAR"]}</div>
        </div>
        <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={onClose} title="Fechar visualização">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center overflow-auto rounded-b-lg bg-slate-100">
        {!url ? (
          <span className="text-sm font-semibold text-slate-500">Preparando visualização...</span>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={document.name} className="max-h-full max-w-full object-contain" />
        ) : isTiff || isDocx ? (
          <div className="max-w-md px-6 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-700">Pré-visualização não disponível neste navegador</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">O arquivo será processado normalmente e ficará disponível no histórico para consulta.</p>
          </div>
        ) : (
          <iframe src={url} title={document.name} className="h-full min-h-[70vh] w-full border-0" />
        )}
      </div>
    </div>
  );
}

function resolveDocumentType(file: File, validationType: ValidationType): UploadedDocument["type"] {
  if (validationType === "ITBI" && /itbi|dti|guia/i.test(file.name)) {
    return "ITBI_GUIDE";
  }

  if (file.type.includes("image")) {
    return file.type === "image/tiff" || /\.tiff?$/i.test(file.name) ? "TIFF" : "IMAGE";
  }

  if (file.type.includes("wordprocessingml") || /\.docx$/i.test(file.name)) {
    return "WORD";
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
  if (/matr[ií]cula|registro.*im[oó]vel/i.test(file.name)) return "MATRICULA";
  if (/certid[aã]o|nascimento|casamento|estado.*civil/i.test(file.name)) return "CERTIDAO";
  if (/reserva|outlook/i.test(file.name) || file.type.includes("image")) return "DADOS_RESERVA";
  return "DOCUMENTO_COMPLEMENTAR";
}
