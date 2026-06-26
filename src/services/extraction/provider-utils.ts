import type { ChecklistField, ProviderExtractionOutput } from "@/domain/validation";

export function checklistPrompt(checklist: ChecklistField[]) {
  return checklist
    .map(
      (field) =>
        `- ${field.id}: ${field.label}; tipo=${field.fieldType}; categoria=${field.category}`,
    )
    .join("\n");
}

export function coerceExtractionOutput(value: unknown, checklist: ChecklistField[]): ProviderExtractionOutput {
  const objectValue = value as {
    fields?: Array<{
      fieldId?: unknown;
      value?: unknown;
      confidence?: unknown;
      sourceLocation?: { page?: unknown; section?: unknown; rawText?: unknown };
    }>;
  };
  const allowedIds = new Set(checklist.map((field) => field.id));
  const fields = Array.isArray(objectValue.fields) ? objectValue.fields : [];

  return {
    fields: checklist.map((field) => {
      const found = fields.find((item) => item.fieldId === field.id && allowedIds.has(field.id));
      return {
        fieldId: field.id,
        value: typeof found?.value === "string" || typeof found?.value === "number" ? String(found.value) : null,
        confidence: clampConfidence(found?.confidence),
        sourceLocation: coerceSourceLocation(found?.sourceLocation),
      };
    }),
  };
}

function coerceSourceLocation(value: { page?: unknown; section?: unknown; rawText?: unknown } | undefined) {
  if (!value) {
    return undefined;
  }

  const page = Number(value.page);
  const section = typeof value.section === "string" ? value.section.trim().slice(0, 120) : undefined;
  const rawText = typeof value.rawText === "string" ? value.rawText.trim().slice(0, 500) : undefined;

  if (!Number.isFinite(page) && !section && !rawText) {
    return undefined;
  }

  return {
    page: Number.isInteger(page) && page > 0 ? page : undefined,
    section,
    rawText,
  };
}

function clampConfidence(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  const percentValue = numberValue > 0 && numberValue <= 1 ? numberValue * 100 : numberValue;
  return Math.round(Math.max(0, Math.min(100, percentValue)));
}
