"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, Clipboard, Eye, X, MonitorUp, ScrollText, Landmark, Files } from "lucide-react";
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
  const [uploadMessage, setUploadMessage] = useState("");

  function handleFiles(files: FileList | null, requestedSource?: DocumentSource) {
    if (!files?.length) {
      return;
    }

    const existing = new Set(documents.map((document) => `${document.name}:${document.sizeBytes}`));
    const acceptedFiles = Array.from(files).filter((file) => !existing.has(`${file.name}:${file.size}`));
    const duplicates = files.length - acceptedFiles.length;
    const nextDocuments = acceptedFiles.map<ClientUploadedDocument>((file) => ({
      id: crypto.randomUUID(),
      organizationId: defaultOrganization.id,
      name: file.name,
      type: resolveDocumentType(file, validationType),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      source: validationType === "RECONCILIATION" ? requestedSource ?? inferDocumentSource(file) : undefined,
      file,
    }));

    onDocumentsChange([...documents, ...nextDocuments]);
    setUploadMessage(duplicates ? `${duplicates} arquivo(s) duplicado(s) não foram adicionados.` : `${nextDocuments.length} arquivo(s) adicionado(s).`);
  }

  function removeDocument(id: string) {
    onDocumentsChange(documents.filter((document) => document.id !== id));
  }

  function updateDocumentSource(id: string, source: DocumentSource) {
    onDocumentsChange(documents.map((document) => (document.id === id ? { ...document, source } : document)));
  }

  return (
    <section className="app-card overflow-hidden">
      <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Etapa 2</div>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{title.replace(/^Etapa 2\s*·\s*/, "")}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-subtle)] p-2.5 text-[var(--muted)]" title="Também aceita Ctrl+V">
          <Clipboard className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SourceUpload icon={MonitorUp} title="Dados da reserva" description="Prints, telas e propostas" count={documents.filter((item) => item.source === "DADOS_RESERVA" || item.source === "SIOPI").length} onFiles={(files) => handleFiles(files, "DADOS_RESERVA")} />
        <SourceUpload icon={ScrollText} title="Minuta ou contrato" description="PDF, DOCX ou RTF" count={documents.filter((item) => item.source === "MINUTA").length} onFiles={(files) => handleFiles(files, "MINUTA")} />
        <SourceUpload icon={Landmark} title="ITBI e imóvel" description="ITBI, matrícula, IPTU e certidões" count={documents.filter((item) => ["ITBI", "MATRICULA", "IPTU", "CERTIDAO"].includes(item.source ?? "")).length} onFiles={(files) => handleFiles(files, "ITBI")} />
        <SourceUpload icon={Files} title="Outros documentos" description="Anexos e documentos complementares" count={documents.filter((item) => item.source === "DOCUMENTO_COMPLEMENTAR").length} onFiles={(files) => handleFiles(files, "DOCUMENTO_COMPLEMENTAR")} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]"><span>PDF, DOCX, RTF, TIFF/TIF, PNG ou JPG · também aceita Ctrl+V</span>{uploadMessage ? <span role="status" className="font-medium text-[var(--primary)]">{uploadMessage}</span> : null}</div>

      <div className="mt-4 space-y-2">
        {documents.map((document) => (
          <div key={document.id} className="flex flex-col gap-2 rounded-xl bg-[var(--surface-subtle)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] shadow-sm">
                {document.mimeType.includes("image") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-[var(--foreground)]">{document.name}</span><span className="block text-[11px] text-[var(--muted)]">{formatFileSize(document.sizeBytes)}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label={`Fonte de ${document.name}`}
                className="app-input min-h-9 px-2 text-xs font-medium"
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

function SourceUpload({ icon: Icon, title, description, count, onFiles }: { icon: typeof MonitorUp; title: string; description: string; count: number; onFiles: (files: FileList | null) => void }) {
  return (
    <label className="group flex min-h-28 cursor-pointer items-center gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] p-4 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]">
      <input className="sr-only" type="file" multiple accept=".pdf,.docx,.rtf,.tif,.tiff,.jpg,.jpeg,.png,image/jpeg,image/png,image/tiff,application/pdf,application/rtf,text/rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }} />
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--primary)] shadow-sm"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[var(--foreground)]">{title}</span><span className="mt-1 block text-xs text-[var(--muted)]">{description}</span><span className="mt-2 block text-xs font-medium text-[var(--primary)]">{count ? `${count} arquivo(s) · adicionar mais` : "Adicionar arquivo"}</span></span>
      <Paperclip className="h-4 w-4 text-slate-400 group-hover:text-[var(--primary)]" />
    </label>
  );
}

function DocumentPreview({ document, onClose }: { document: ClientUploadedDocument; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(document.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [document.file]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isTiff = document.mimeType === "image/tiff" || /\.tiff?$/i.test(document.name);
  const isDocx = document.mimeType.includes("wordprocessingml") || /\.docx$/i.test(document.name);
  const isRtf = document.mimeType === "application/rtf" || document.mimeType === "text/rtf" || /\.rtf$/i.test(document.name);
  const isImage = document.mimeType.includes("image") && !isTiff;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Visualização de ${document.name}`}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-t-lg bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-950">{document.name}</div>
          <div className="text-xs text-slate-500">{documentSourceLabels[document.source ?? "DOCUMENTO_COMPLEMENTAR"]}</div>
        </div>
        <button ref={closeButtonRef} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={onClose} title="Fechar visualização">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center overflow-auto rounded-b-lg bg-slate-100">
        {!url ? (
          <span className="text-sm font-semibold text-slate-500">Preparando visualização...</span>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={document.name} className="max-h-full max-w-full object-contain" />
        ) : isTiff || isDocx || isRtf ? (
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

function formatFileSize(bytes?: number) {
  if (!bytes) return "Tamanho não informado";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  if (file.type === "application/rtf" || file.type === "text/rtf" || /\.rtf$/i.test(file.name)) {
    return "WORD";
  }

  if (file.type.includes("pdf")) {
    return "PDF";
  }

  return validationType === "ITBI" ? "COMPLEMENTARY" : "CONTRACT";
}

function inferDocumentSource(file: File): DocumentSource {
  const name = file.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/itbi|dti|guia/.test(name)) return "ITBI";
  if (/iptu|inscricao\s*(imobiliaria|municipal)/.test(name)) return "IPTU";
  if (/fracao/.test(name)) return "FRACOES";
  if (/minuta|contrato|instrumento/.test(name)) return "MINUTA";
  if (/siopi|espelho.*proposta|concessao/.test(name)) return "SIOPI";
  if (/matricula|registro.*imovel/.test(name)) return "MATRICULA";
  if (/certidao|nascimento|casamento|estado.*civil/.test(name)) return "CERTIDAO";
  if (/reserva|outlook/.test(name) || file.type.includes("image")) return "DADOS_RESERVA";
  return "DOCUMENTO_COMPLEMENTAR";
}
