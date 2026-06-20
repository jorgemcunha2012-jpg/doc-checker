import type {
  ChecklistField,
  ExtractedDocumentData,
  ValidationResult,
  ValidationRun,
  ValidationStatus,
  ValidationType,
} from "@/domain/validation";
import { getChecklist } from "@/domain/checklists";

const reviewTokens = ["revisar", "não localizado", "nao localizado", "pendente"];

export class ValidationEngine {
  run(
    validationType: ValidationType,
    sourceData: ExtractedDocumentData,
    targetData: ExtractedDocumentData,
  ): ValidationRun {
    const checklist = getChecklist(validationType);
    const results = checklist.map((field) => this.compareField(field, sourceData[field.id], targetData[field.id]));

    return {
      id: crypto.randomUUID(),
      validationType,
      checklist,
      results,
      summary: {
        totalChecked: results.length,
        divergences: results.filter((result) => result.status === "DIVERGENCE").length,
        reviewRequired: results.filter((result) => result.status === "REVIEW_REQUIRED" || result.status === "NOT_FOUND").length,
      },
    };
  }

  private compareField(field: ChecklistField, sourceValue?: string, targetValue?: string): ValidationResult {
    const source = sourceValue?.trim() ?? "";
    const target = targetValue?.trim() ?? "";
    const status = this.resolveStatus(field.required, source, target);

    return {
      field,
      sourceValue: source || "Não encontrado",
      targetValue: target || "Não encontrado",
      status,
      observation: this.buildObservation(status),
    };
  }

  private resolveStatus(required: boolean, source: string, target: string): ValidationStatus {
    if (!source && !target && !required) {
      return "NOT_APPLICABLE";
    }

    if (!source || !target) {
      return "NOT_FOUND";
    }

    if (this.requiresReview(source) || this.requiresReview(target)) {
      return "REVIEW_REQUIRED";
    }

    if (this.normalize(source) === this.normalize(target)) {
      return "MATCH";
    }

    return "DIVERGENCE";
  }

  private normalize(value: string) {
    return value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, "")
      .toLowerCase();
  }

  private requiresReview(value: string) {
    const normalized = value.toLowerCase();
    return reviewTokens.some((token) => normalized.includes(token));
  }

  private buildObservation(status: ValidationStatus) {
    const observations: Record<ValidationStatus, string> = {
      MATCH: "Campo conferido automaticamente.",
      DIVERGENCE: "Valores diferentes entre origem e destino.",
      NOT_FOUND: "Informação ausente em uma das fontes.",
      NOT_APPLICABLE: "Campo opcional sem ocorrência para este processo.",
      REVIEW_REQUIRED: "Campo localizado, mas exige revisão humana.",
    };

    return observations[status];
  }
}
