"use client";

import { useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { documentSourceLabels, type DocumentSource } from "@/domain/validation";

export type ProcessDocumentItem = {
  id: string;
  name: string;
  source?: string | null;
  storage_path?: string | null;
};

export function ProcessDocumentList({
  processId,
  documents,
}: {
  processId: string;
  documents: ProcessDocumentItem[];
}) {
  const [pinnedDocument, setPinnedDocument] = useState<ProcessDocumentItem | null>(null);

  if (!documents.length) {
    return <p className="py-4 text-sm text-slate-500">Nenhum documento foi registrado.</p>;
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {documents.map((document) => (
          <DocumentRow
            key={document.id}
            processId={processId}
            document={document}
            onPin={() => setPinnedDocument(document)}
          />
        ))}
      </div>
      {pinnedDocument ? (
        <DocumentPreviewModal
          processId={processId}
          document={pinnedDocument}
          onClose={() => setPinnedDocument(null)}
        />
      ) : null}
    </>
  );
}

function DocumentRow({
  processId,
  document,
  onPin,
}: {
  processId: string;
  document: ProcessDocumentItem;
  onPin: () => void;
}) {
  const previewUrl = documentUrl(processId, document.id);
  const previewable = Boolean(document.storage_path) && isPreviewable(document.name);

  return (
    <div className="group/document relative flex items-center justify-between gap-3 py-3 text-sm">
      <button
        type="button"
        className="min-w-0 truncate text-left font-medium text-slate-700 hover:text-slate-950"
        onClick={document.storage_path ? onPin : undefined}
        disabled={!document.storage_path}
        title={document.name}
      >
        {document.name}
      </button>
      {document.storage_path ? (
        <button
          type="button"
          onClick={onPin}
          className="shrink-0 font-bold text-[#0f8f88] hover:text-[#0b6f6a]"
        >
          Visualizar
        </button>
      ) : (
        <span className="shrink-0 text-xs text-slate-400">Original indisponível</span>
      )}
      {document.storage_path ? (
        <div className="pointer-events-none absolute right-0 top-9 z-30 hidden w-[min(520px,calc(100vw-3rem))] border border-slate-200 bg-white shadow-2xl group-hover/document:block group-focus-within/document:block">
          <PreviewFrame
            url={previewUrl}
            document={document}
            previewable={previewable}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}

function DocumentPreviewModal({
  processId,
  document,
  onClose,
}: {
  processId: string;
  document: ProcessDocumentItem;
  onClose: () => void;
}) {
  const url = documentUrl(processId, document.id);
  const previewable = isPreviewable(document.name);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Visualização de ${document.name}`}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-t-lg bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-950">{document.name}</div>
          <div className="text-xs text-slate-500">{sourceLabel(document.source)}</div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Nova aba
          </a>
          <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={onClose} title="Fechar visualização">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-hidden rounded-b-lg bg-slate-100">
        <PreviewFrame url={url} document={document} previewable={previewable} />
      </div>
    </div>
  );
}

function PreviewFrame({
  url,
  document,
  previewable,
  compact = false,
}: {
  url: string;
  document: ProcessDocumentItem;
  previewable: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "h-80 bg-slate-100" : "h-full min-h-[72vh] bg-slate-100"}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0 truncate text-xs font-bold text-slate-800">{document.name}</div>
        <div className="shrink-0 text-[11px] font-semibold text-slate-500">{sourceLabel(document.source)}</div>
      </div>
      {previewable ? (
        <iframe src={url} title={document.name} className="h-[calc(100%-33px)] w-full border-0" />
      ) : (
        <div className="flex h-[calc(100%-33px)] items-center justify-center px-6 text-center">
          <div>
            <FileText className="mx-auto h-9 w-9 text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-700">Prévia rápida indisponível</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use a visualização fixa ou abra em nova aba para consultar este formato.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function documentUrl(processId: string, documentId: string) {
  return `/api/processes/${processId}/documents/${documentId}`;
}

function isPreviewable(name: string) {
  return /\.(pdf|png|jpe?g)$/i.test(name);
}

function sourceLabel(source: string | null | undefined) {
  return source && source in documentSourceLabels
    ? documentSourceLabels[source as DocumentSource]
    : "Documento do processo";
}
