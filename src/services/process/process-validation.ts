import { defaultOrganization, defaultUser } from "@/domain/tenant";
import type { ExtractedFieldValue, UploadedDocument, ValidationProcess, ValidationType } from "@/domain/validation";
import { getChecklist } from "@/domain/checklists";
import { DocumentExtractionService } from "@/services/extraction/document-extraction-service";
import type { UploadedDocumentPayload } from "@/services/extraction/types";
import { ValidationEngine } from "@/services/validation/validation-engine";
import { ReconciliationEngine } from "@/services/validation/reconciliation-engine";
import { getValidationProcess, saveValidationProcess, updateValidationProcess } from "./validation-process-store";
import { audit, persistDocuments, persistOriginalDocuments, persistProcess, persistResults } from "./process-repository";

export function createValidationProcess(validationType: ValidationType, documents: UploadedDocumentPayload[]) {
  const process = createBaseValidationProcess(validationType, documents);

  saveValidationProcess(process);
  void processValidation(process.id, validationType, documents);

  return process;
}

export async function createValidationProcessAndWait(validationType: ValidationType, documents: UploadedDocumentPayload[], user = defaultUser) {
  const process = createBaseValidationProcess(validationType, documents, user);

  saveValidationProcess(process);
  await Promise.all([persistProcess(process), persistDocuments(process.id, process.documents)]);
  if (!(await storeOriginalsOrFail(process.id, documents))) return getValidationProcess(process.id) ?? process;
  await audit({ id: user.id, organizationId: user.organizationId }, "PROCESS_CREATED", "validation_process", process.id, {
    documents: process.documents.map((document) => document.name),
  });
  await processValidation(process.id, validationType, documents);

  return getValidationProcess(process.id) ?? process;
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
  const process = createBaseValidationProcess(validationType, documents, user);

  saveValidationProcess(process);
  await Promise.all([persistProcess(process), persistDocuments(process.id, process.documents)]);
  if (!(await storeOriginalsOrFail(process.id, documents))) return getValidationProcess(process.id) ?? process;
  await audit({ id: user.id, organizationId: user.organizationId }, "PROCESS_CREATED", "validation_process", process.id, {
    documents: process.documents.map((document) => document.name),
  });
  schedule(() => processValidation(process.id, validationType, documents, referenceValues));

  return process;
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
  try {
    await updateAndPersist(processId, { status: "EXTRACTING" });
    const checklist = getChecklist(validationType);
    const extractionService = new DocumentExtractionService();
    const result =
      validationType === "RECONCILIATION"
        ? await processReconciliation(processId, extractionService, checklist, documents, referenceValues)
        : await processLegacyValidation(processId, extractionService, validationType, checklist, documents);

    const completed = await updateAndPersist(processId, { status: "DONE", result });
    if (completed?.result?.validationType === "RECONCILIATION") {
      await persistResults(processId, completed.result);
    }
    if (completed) {
      await audit({ id: completed.userId, organizationId: completed.organizationId }, "PROCESS_FINISHED", "validation_process", completed.id, {
        documents: completed.documents.map((document) => document.name),
        summary: completed.result?.summary,
        durationMs: durationMs(completed.createdAt, completed.updatedAt),
      });
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
        durationMs: durationMs(failed.createdAt, failed.updatedAt),
      });
    }
  }
}

async function processLegacyValidation(
  processId: string,
  extractionService: DocumentExtractionService,
  validationType: "MINUTA" | "ITBI",
  checklist: ReturnType<typeof getChecklist>,
  documents: UploadedDocumentPayload[],
) {
  const extraction = await extractionService.extract({ validationType, checklist, documents });
  await updateAndPersist(processId, { status: "COMPARING" });
  const engine = new ValidationEngine();
  return engine.run(defaultOrganization.id, validationType, extraction.sourceData, extraction.targetData, extraction.usedPdfVisionFallback);
}

async function processReconciliation(
  processId: string,
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
  return {
    ...engine.run(defaultOrganization.id, {
      ...extraction,
      values: [...extraction.values, ...referenceValues],
      participatingSources: hasReference
        ? [...extraction.participatingSources, "CADASTRO_EMPREENDIMENTO"]
        : extraction.participatingSources,
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
