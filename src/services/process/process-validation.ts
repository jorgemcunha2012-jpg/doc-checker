import { defaultUser } from "@/domain/tenant";
import type { ExtractedFieldValue, UploadedDocument, ValidationProcess, ValidationType } from "@/domain/validation";
import { getChecklist } from "@/domain/checklists";
import { DocumentExtractionService } from "@/services/extraction/document-extraction-service";
import type { UploadedDocumentPayload } from "@/services/extraction/types";
import { ValidationEngine } from "@/services/validation/validation-engine";
import { ReconciliationEngine } from "@/services/validation/reconciliation-engine";
import { getValidationProcess, saveValidationProcess, updateValidationProcess } from "./validation-process-store";
import { audit, persistDocuments, persistOriginalDocuments, persistProcess, persistResults } from "./process-repository";
import { loadLearnedEquivalences } from "./learning-repository";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export function createValidationProcess(validationType: ValidationType, documents: UploadedDocumentPayload[]) {
  assertProcessHasDocuments(documents);
  const process = createBaseValidationProcess(validationType, documents);

  saveValidationProcess(process);
  void processValidation(process.id, validationType, documents);

  return process;
}

export async function createValidationProcessAndWait(validationType: ValidationType, documents: UploadedDocumentPayload[], user = defaultUser) {
  assertProcessHasDocuments(documents);
  const process = createBaseValidationProcess(validationType, documents, user);

  saveValidationProcess(process);
  if (!(await persistProcessInitialization(process))) return getValidationProcess(process.id) ?? process;
  if (!(await storeOriginalsOrFail(process.id, documents))) return getValidationProcess(process.id) ?? process;
  await audit({ id: user.id, organizationId: user.organizationId }, "PROCESS_CREATED", "validation_process", process.id, {
    documents: process.documents.map((document) => document.name),
  });
  await processValidation(process.id, validationType, documents);

  return getValidationProcess(process.id) ?? process;
}

export async function resumePersistedValidationProcess(processId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: persisted, error } = await supabase
    .from("validation_processes")
    .select("id, organization_id, user_id, validation_type, started_at, process_documents(id, name, document_type, source, mime_type, size_bytes, storage_path, organization_id)")
    .eq("id", processId)
    .single();
  if (error || !persisted) throw new Error(error?.message ?? "Processo não encontrado.");
  if (!persisted.process_documents?.length) throw new Error("O processo não possui documentos para retomar.");

  const documents: UploadedDocumentPayload[] = [];
  for (const document of persisted.process_documents) {
    if (!document.storage_path) throw new Error(`Arquivo indisponível: ${document.name}`);
    const { data, error: downloadError } = await supabase.storage.from("process-documents").download(document.storage_path);
    if (downloadError || !data) throw new Error(`Não foi possível recuperar ${document.name}.`);
    documents.push({
      id: document.id,
      organizationId: document.organization_id ?? persisted.organization_id,
      name: document.name,
      type: document.document_type,
      source: document.source,
      mimeType: document.mime_type,
      sizeBytes: document.size_bytes,
      storagePath: document.storage_path,
      buffer: Buffer.from(await data.arrayBuffer()),
    });
  }

  const now = new Date().toISOString();
  saveValidationProcess({
    id: persisted.id,
    organizationId: persisted.organization_id,
    userId: persisted.user_id,
    validationType: persisted.validation_type,
    status: "PENDING",
    createdAt: persisted.started_at,
    updatedAt: now,
    documents: documents.map(stripBuffer),
  });
  await processValidation(persisted.id, persisted.validation_type, documents);
  return getValidationProcess(persisted.id);
}

export async function createValidationProcessAndStart(
  validationType: ValidationType,
  documents: UploadedDocumentPayload[],
  user = defaultUser,
  schedule: (task: () => Promise<void>) => void = (task) => {
    void task();
  },
  referenceValues: ExtractedFieldValue[] = [],
) {
  assertProcessHasDocuments(documents);
  const process = createBaseValidationProcess(validationType, documents, user);

  saveValidationProcess(process);
  if (!(await persistProcessInitialization(process))) return getValidationProcess(process.id) ?? process;
  if (!(await storeOriginalsOrFail(process.id, documents))) return getValidationProcess(process.id) ?? process;
  await audit({ id: user.id, organizationId: user.organizationId }, "PROCESS_CREATED", "validation_process", process.id, {
    documents: process.documents.map((document) => document.name),
  });
  schedule(() => processValidation(process.id, validationType, documents, referenceValues));

  return process;
}

function assertProcessHasDocuments(documents: UploadedDocumentPayload[]) {
  if (!documents.length) {
    throw new Error("Não é possível criar uma conferência sem documentos.");
  }
}

async function persistProcessInitialization(process: ValidationProcess) {
  try {
    // The documents table references the process row. Persisting them in parallel
    // can race on a fresh process and intermittently violate the foreign key.
    await persistProcess(process);
    await persistDocuments(process.id, process.documents);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar a conferência.";
    const failed = updateValidationProcess(process.id, {
      status: "FAILED",
      error: `Falha ao registrar os documentos da conferência: ${message}`,
    });

    if (failed) {
      try {
        await persistProcess(failed);
        await audit({ id: failed.userId, organizationId: failed.organizationId }, "PROCESS_FAILED", "validation_process", failed.id, {
          stage: "INITIALIZATION",
          documents: failed.documents.map((document) => document.name),
          error: failed.error,
        });
      } catch (persistenceError) {
        console.error("[ConferIA] Não foi possível registrar a falha de inicialização", persistenceError);
      }
    }

    return false;
  }
}

function createBaseValidationProcess(validationType: ValidationType, documents: UploadedDocumentPayload[], user = defaultUser): ValidationProcess {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    organizationId: user.organizationId,
    userId: user.id,
    validationType,
    status: "PENDING",
    documents: documents.map(stripBuffer),
    createdAt: now,
    updatedAt: now,
  };
}

async function processValidation(
  processId: string,
  validationType: ValidationType,
  documents: UploadedDocumentPayload[],
  referenceValues: ExtractedFieldValue[] = [],
) {
  const executionStartedAt = Date.now();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    await updateAndPersist(processId, { status: "EXTRACTING" });
    // A worker ativo atualiza o processo periodicamente. Isso distingue uma fila
    // abandonada de uma extração extensa e permite uma retomada segura pelo cliente.
    heartbeat = setInterval(() => {
      const current = getValidationProcess(processId);
      void updateAndPersist(processId, { status: current?.status ?? "EXTRACTING" }).catch((error) => {
        console.error("[ConferIA] Não foi possível atualizar o heartbeat do processo", error);
      });
    }, 20_000);
    const checklist = getChecklist(validationType);
    const process = getValidationProcess(processId);
    if (!process) throw new Error("Processo não encontrado durante o processamento.");
    const extractionService = new DocumentExtractionService();
    const result =
      validationType === "RECONCILIATION"
        ? await processReconciliation(processId, process.organizationId, extractionService, checklist, documents, referenceValues)
        : await processLegacyValidation(processId, process.organizationId, extractionService, validationType, checklist, documents);

    const completed = await updateAndPersist(processId, { status: "DONE", result });
    if (completed?.result?.validationType === "RECONCILIATION") {
      await persistResults(processId, completed.result);
    }
    if (completed) {
      const elapsedMs = durationMs(completed.createdAt, completed.updatedAt);
      const executionDurationMs = Date.now() - executionStartedAt;
      const queueDelayMs = Math.max(0, executionStartedAt - new Date(completed.createdAt).getTime());
      await audit({ id: completed.userId, organizationId: completed.organizationId }, "PROCESS_FINISHED", "validation_process", completed.id, {
        documents: completed.documents.map((document) => document.name),
        summary: completed.result?.summary,
        extractionQualityBySource: completed.result?.validationType === "RECONCILIATION"
          ? completed.result.extractionQualityBySource
          : undefined,
        durationMs: executionDurationMs,
        executionDurationMs,
        queueDelayMs,
        totalElapsedMs: elapsedMs,
      });
      if (executionDurationMs >= 10 * 60 * 1000) {
        await audit({ id: completed.userId, organizationId: completed.organizationId }, "PROCESS_SLOW", "validation_process", completed.id, {
          documents: completed.documents.map((document) => document.name),
          durationMs: executionDurationMs,
          executionDurationMs,
          queueDelayMs,
          totalElapsedMs: elapsedMs,
          thresholdMs: 10 * 60 * 1000,
        });
      }
    }
  } catch (error) {
    const failed = await updateAndPersist(processId, {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Erro inesperado no processamento.",
    });
    if (failed) {
      await audit({ id: failed.userId, organizationId: failed.organizationId }, "PROCESS_FAILED", "validation_process", failed.id, {
        documents: failed.documents.map((document) => document.name),
        error: failed.error,
        durationMs: Date.now() - executionStartedAt,
        executionDurationMs: Date.now() - executionStartedAt,
        queueDelayMs: Math.max(0, executionStartedAt - new Date(failed.createdAt).getTime()),
        totalElapsedMs: durationMs(failed.createdAt, failed.updatedAt),
      });
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

async function processLegacyValidation(
  processId: string,
  organizationId: string,
  extractionService: DocumentExtractionService,
  validationType: "MINUTA" | "ITBI",
  checklist: ReturnType<typeof getChecklist>,
  documents: UploadedDocumentPayload[],
) {
  const extraction = await extractionService.extract({ validationType, checklist, documents });
  await updateAndPersist(processId, { status: "COMPARING" });
  const engine = new ValidationEngine();
  return engine.run(organizationId, validationType, extraction.sourceData, extraction.targetData, extraction.usedPdfVisionFallback);
}

async function processReconciliation(
  processId: string,
  organizationId: string,
  extractionService: DocumentExtractionService,
  checklist: ReturnType<typeof getChecklist>,
  documents: UploadedDocumentPayload[],
  referenceValues: ExtractedFieldValue[] = [],
) {
  const extraction = await extractionService.extractReconciliation({
    validationType: "RECONCILIATION",
    checklist,
    documents,
  });
  await updateAndPersist(processId, { status: "COMPARING" });
  const engine = new ReconciliationEngine();
  const hasReference = referenceValues.length > 0;
  const learnedEquivalences = await loadLearnedEquivalences(organizationId);
  return {
    ...engine.run(organizationId, {
      ...extraction,
      values: [...extraction.values, ...referenceValues],
      participatingSources: hasReference
        ? [...extraction.participatingSources, "CADASTRO_EMPREENDIMENTO"]
        : extraction.participatingSources,
      learnedEquivalences,
    }),
    id: processId,
  };
}

async function updateAndPersist(processId: string, patch: Partial<ValidationProcess>) {
  const process = updateValidationProcess(processId, patch);
  if (process) await persistProcess(process);
  return process;
}

function durationMs(startedAt: string, completedAt: string) {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

async function storeOriginalsOrFail(processId: string, documents: UploadedDocumentPayload[]) {
  try {
    await persistOriginalDocuments(processId, documents);
    return true;
  } catch (error) {
    await updateAndPersist(processId, {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Não foi possível armazenar os documentos originais.",
    });
    return false;
  }
}

function stripBuffer(document: UploadedDocumentPayload): UploadedDocument {
  const metadata: UploadedDocument = {
    id: document.id,
    organizationId: document.organizationId,
    name: document.name,
    type: document.type,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    source: document.source,
  };

  return metadata;
}
