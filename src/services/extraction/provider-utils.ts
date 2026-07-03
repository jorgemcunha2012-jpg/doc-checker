import type { ChecklistField, ExtractedField, ProviderExtractionOutput } from "@/domain/validation";

export function checklistPrompt(checklist: ChecklistField[]) {
  return checklist
    .map(
      (field) =>
        `- ${field.id}: ${field.label}; tipo=${field.fieldType}; categoria=${field.category}${field.allowMultiple ? "; repetível por participante; retorne uma entrada por pessoa e use o mesmo participantId em todos os campos da mesma pessoa" : ""}${fieldExtractionHint(field.id) ? `; regra=${fieldExtractionHint(field.id)}` : ""}`,
    )
    .join("\n");
}

export function fieldExtractionHint(fieldId: string) {
  return ({
    "buyer.address":
      "extrair somente o domicílio/endereço residencial do comprador, adquirente ou cliente na qualificação pessoal; nunca usar endereço do imóvel, empreendimento ou unidade",
    "seller.address":
      "extrair somente a sede ou endereço do vendedor/transmitente na qualificação da parte; nunca usar endereço do imóvel",
    "property.address":
      "extrair somente a localização física do imóvel objeto do negócio, normalmente na descrição do imóvel, matrícula, empreendimento ou unidade; nunca usar domicílio do comprador ou endereço do vendedor",
  } as Record<string, string>)[fieldId] ?? "";
}

export function coerceExtractionOutput(value: unknown, checklist: ChecklistField[]): ProviderExtractionOutput {
  const objectValue = value as {
    fields?: Array<{
      fieldId?: unknown;
      value?: unknown;
      confidence?: unknown;
      sourceLocation?: { page?: unknown; section?: unknown; rawText?: unknown };
      participantId?: unknown;
    }>;
  };
  const allowedIds = new Set(checklist.map((field) => field.id));
  const fields = Array.isArray(objectValue.fields) ? objectValue.fields : [];

  return {
    fields: checklist.flatMap((field): ExtractedField[] => {
      const found = fields.filter((item) => item.fieldId === field.id && allowedIds.has(field.id));
      const candidates = field.allowMultiple ? found : found.slice(0, 1);
      if (!candidates.length) {
        return [{ fieldId: field.id, value: null, confidence: 0, sourceLocation: undefined, participantId: undefined }];
      }
      return candidates.map((item, index) => ({
        fieldId: field.id,
        value: typeof item.value === "string" || typeof item.value === "number" ? String(item.value) : null,
        confidence: clampConfidence(item.confidence),
        sourceLocation: coerceSourceLocation(item.sourceLocation),
        participantId: field.allowMultiple ? coerceParticipantId(item.participantId, index) : undefined,
      }));
    }),
  };
}

function coerceParticipantId(value: unknown, index: number) {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 60)
    : "";
  return normalized || `buyer_${index + 1}`;
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
