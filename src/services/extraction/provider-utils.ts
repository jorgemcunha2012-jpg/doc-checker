import type { ChecklistField, ProviderExtractionOutput } from "@/domain/validation";

export function checklistPrompt(checklist: ChecklistField[]) {
  return checklist
    .map(
      (field) =>
        `- ${field.id}: ${field.category} / ${field.label} / item=${field.itemType} / obrigatório=${field.required} / tipo=${field.fieldType}`,
    )
    .join("\n");
}

export function coerceExtractionOutput(value: unknown, checklist: ChecklistField[]): ProviderExtractionOutput {
  const objectValue = value as { fields?: Array<{ fieldId?: unknown; value?: unknown; confidence?: unknown }> };
  const allowedIds = new Set(checklist.map((field) => field.id));
  const fields = Array.isArray(objectValue.fields) ? objectValue.fields : [];

  return {
    fields: checklist.map((field) => {
      const found = fields.find((item) => item.fieldId === field.id && allowedIds.has(field.id));
      return {
        fieldId: field.id,
        value: typeof found?.value === "string" ? found.value : null,
        confidence: clampConfidence(found?.confidence),
      };
    }),
  };
}

function clampConfidence(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, numberValue));
}
