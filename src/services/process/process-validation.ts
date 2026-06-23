import { defaultOrganization, defaultUser } from "@/domain/tenant";
import type { UploadedDocument, ValidationProcess, ValidationType } from "@/domain/validation";
import { getChecklist } from "@/domain/checklists";
import { DocumentExtractionService } from "@/services/extraction/document-extraction-service";
import type { UploadedDocumentPayload } from "@/services/extraction/types";
import { ValidationEngine } from "@/services/validation/validation-engine";
import { ReconciliationEngine } from "@/services/validation/reconciliation-engine";
import { getValidationProcess, saveValidationProcess, updateValidationProcess } from "./validation-process-store";

export function createValidationProcess(validationType: ValidationType, documents: UploadedDocumentPayload[]) {
  const process = createBaseValidationProcess(validationType, documents);

  saveValidationProcess(process);
  void processValidation(process.id, validationType, documents);

  return process;
}

export async function createValidationProcessAndWait(validationType: ValidationType, documents: UploadedDocumentPayload[]) {
  const process = createBaseValidationProcess(validationType, documents);

  saveValidationProcess(process);
  await processValidation(process.id, validationType, documents);

  return getValidationProcess(process.id) ?? process;
}

function createBaseValidationProcess(validationType: ValidationType, documents: UploadedDocumentPayload[]): ValidationProcess {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    organizationId: defaultOrganization.id,
    userId: defaultUser.id,
    validationType,
    status: "PENDING",
    documents: documents.map(stripBuffer),
    createdAt: now,
    updatedAt: now,
  };
}

async function processValidation(processId: string, validationType: ValidationType, documents: UploadedDocumentPayload[]) {
  try {
    updateValidationProcess(processId, { status: "EXTRACTING" });
    const checklist = getChecklist(validationType);
    const extractionService = new DocumentExtractionService();
    const result =
      validationType === "RECONCILIATION"
        ? await processReconciliation(processId, extractionService, checklist, documents)
        : await processLegacyValidation(processId, extractionService, validationType, checklist, documents);

    updateValidationProcess(processId, { status: "DONE", result });
  } catch (error) {
    updateValidationProcess(processId, {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Erro inesperado no processamento.",
    });
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
  updateValidationProcess(processId, { status: "COMPARING" });
  const engine = new ValidationEngine();
  return engine.run(defaultOrganization.id, validationType, extraction.sourceData, extraction.targetData, extraction.usedPdfVisionFallback);
}

async function processReconciliation(
  processId: string,
  extractionService: DocumentExtractionService,
  checklist: ReturnType<typeof getChecklist>,
  documents: UploadedDocumentPayload[],
) {
  const extraction = await extractionService.extractReconciliation({
    validationType: "RECONCILIATION",
    checklist,
    documents,
  });
  updateValidationProcess(processId, { status: "COMPARING" });
  const engine = new ReconciliationEngine();
  return engine.run(defaultOrganization.id, extraction);
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
