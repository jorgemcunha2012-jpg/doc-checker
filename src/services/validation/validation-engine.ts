import type {
  ChecklistField,
  ExtractedDocumentData,
  ProviderExtractionOutput,
  ValidationResult,
  ValidationRun,
  ValidationStatus,
  ValidationType,
} from "@/domain/validation";
import { getChecklist } from "@/domain/checklists";
import { normalizeValue } from "@/services/normalization/normalization-service";
import { buildDivergenceDiagnostic } from "./divergence-diagnostics";

const LOW_CONFIDENCE_THRESHOLD = 70;

export class ValidationEngine {
  run(
    organizationId: string,
    validationType: ValidationType,
    sourceOutput: ProviderExtractionOutput,
    targetOutput: ProviderExtractionOutput,
    usedPdfVisionFallback: boolean,
  ): ValidationRun {
    const checklist = getChecklist(validationType);
    const sourceData = toExtractedDocumentData(sourceOutput);
    const targetData = toExtractedDocumentData(targetOutput);
    const results = checklist.map((field) => this.compareField(organizationId, field, sourceData, targetData));

    return {
      id: crypto.randomUUID(),
      organizationId,
      validationType,
      checklist,
      results,
      usedPdfVisionFallback,
      summary: {
        totalChecked: results.length,
        divergences: results.filter((result) => result.status === "DIVERGENCE").length,
        reviewRequired: results.filter((result) => result.status === "REVIEW_REQUIRED" || result.status === "NOT_FOUND").length,
      },
    };
  }

  private compareField(
    organizationId: string,
    field: ChecklistField,
    sourceData: ExtractedDocumentData,
    targetData: ExtractedDocumentData,
  ): ValidationResult {
    const source = sourceData[field.id];
    const target = targetData[field.id];
    const sourceValue = source?.value?.trim() ?? "";
    const targetValue = target?.value?.trim() ?? "";
    const sourceValueNormalized = normalizeValue(sourceValue, field.fieldType);
    const targetValueNormalized = normalizeValue(targetValue, field.fieldType);
    const sourceConfidence = source?.confidence ?? 0;
    const targetConfidence = target?.confidence ?? 0;
    const status = this.resolveStatus(field.required, sourceValueNormalized, targetValueNormalized, sourceConfidence, targetConfidence);
    const diagnostic =
      status === "DIVERGENCE"
        ? buildDivergenceDiagnostic(field.fieldType, sourceValue, targetValue, sourceValueNormalized, targetValueNormalized)
        : undefined;

    return {
      organizationId,
      field,
      sourceValue: sourceValue || "Não encontrado",
      targetValue: targetValue || "Não encontrado",
      sourceValueNormalized,
      targetValueNormalized,
      sourceDiffTokens: diagnostic?.sourceDiffTokens,
      targetDiffTokens: diagnostic?.targetDiffTokens,
      sourceConfidence,
      targetConfidence,
      status,
      observation: diagnostic?.observation ?? this.buildObservation(status),
    };
  }

  private resolveStatus(
    required: boolean,
    sourceNormalized: string,
    targetNormalized: string,
    sourceConfidence: number,
    targetConfidence: number,
  ): ValidationStatus {
    if (!sourceNormalized && !targetNormalized && !required) {
      return "NOT_APPLICABLE";
    }

    if (!sourceNormalized || !targetNormalized) {
      return "NOT_FOUND";
    }

    if (sourceConfidence < LOW_CONFIDENCE_THRESHOLD || targetConfidence < LOW_CONFIDENCE_THRESHOLD) {
      return "REVIEW_REQUIRED";
    }

    if (sourceNormalized === targetNormalized) {
      return "MATCH";
    }

    return "DIVERGENCE";
  }

  private buildObservation(status: ValidationStatus) {
    const observations: Record<ValidationStatus, string> = {
      MATCH: "Campo conferido automaticamente após normalização.",
      DIVERGENCE: "Valores normalizados diferentes entre origem e destino.",
      NOT_FOUND: "Informação ausente em uma das fontes.",
      NOT_APPLICABLE: "Campo opcional ausente nas duas fontes.",
      REVIEW_REQUIRED: "Extração com confiança abaixo de 70%.",
    };

    return observations[status];
  }
}

function toExtractedDocumentData(output: ProviderExtractionOutput): ExtractedDocumentData {
  return Object.fromEntries(output.fields.map((field) => [field.fieldId, field]));
}
