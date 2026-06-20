"use server";

import type { UploadedDocument, ValidationType } from "@/domain/validation";
import { MockExtractionService } from "@/services/extraction/mock-extraction-service";
import { ValidationEngine } from "./validation-engine";

export async function runValidation(validationType: ValidationType, documents: UploadedDocument[]) {
  const extractionService = new MockExtractionService();
  const extraction = await extractionService.extract({ validationType, documents });
  const engine = new ValidationEngine();

  return {
    extraction,
    validation: engine.run(validationType, extraction.sourceData, extraction.targetData),
  };
}
