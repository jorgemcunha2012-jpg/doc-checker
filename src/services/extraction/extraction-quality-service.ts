import type {
  ChecklistField,
  DocumentSource,
  ExtractedFieldValue,
  ExtractionQualityReport,
  ProviderExtractionOutput,
} from "@/domain/validation";

const LOW_CRITICAL_CONFIDENCE_THRESHOLD = 75;

const criticalFieldsBySource: Partial<Record<DocumentSource, string[]>> = {
  MINUTA: [
    "buyer.name",
    "buyer.cpf",
    "property.development",
    "property.unit",
    "property.tower",
    "financial.financing",
    "financial.totalValue",
  ],
  SIOPI: [
    "buyer.name",
    "buyer.cpf",
    "property.development",
    "property.registration",
    "property.unit",
    "property.tower",
    "financial.financing",
    "financial.totalValue",
  ],
  ITBI: [
    "buyer.name",
    "buyer.cpf",
    "seller.cnpj",
    "property.registration",
    "financial.financing",
    "financial.totalValue",
  ],
  DADOS_RESERVA: [
    "buyer.name",
    "property.development",
    "property.unit",
    "property.tower",
    "financial.financing",
    "financial.totalValue",
  ],
  MATRICULA: [
    "property.registration",
    "property.unit",
    "property.tower",
    "property.privateArea",
  ],
};

export function criticalChecklistFields(source: DocumentSource, checklist: ChecklistField[]) {
  const expected = new Set(criticalFieldsBySource[source] ?? []);
  return checklist.filter((field) => expected.has(field.id));
}

export function missingCriticalFields(
  source: DocumentSource,
  output: ProviderExtractionOutput,
  checklist: ChecklistField[],
) {
  return criticalChecklistFields(source, checklist).filter(
    (field) => !output.fields.some((value) => value.fieldId === field.id && hasValue(value.value)),
  );
}

export function buildExtractionQuality(
  source: DocumentSource,
  values: ExtractedFieldValue[],
  checklist: ChecklistField[],
  recoveredFields: string[],
  deterministicFields: string[],
  conflictedFields: string[],
  unreadable: boolean,
): ExtractionQualityReport {
  const expected = criticalChecklistFields(source, checklist).map((field) => field.id);
  if (!expected.length) {
    return {
      source,
      status: unreadable ? "FAILED" : "NOT_ASSESSED",
      expectedCriticalFields: [],
      extractedCriticalFields: [],
      missingCriticalFields: [],
      lowConfidenceCriticalFields: [],
      ambiguousCriticalFields: [],
      recoveredFields: [],
      deterministicFields: [],
      coverage: unreadable ? 0 : 100,
    };
  }
  const extracted = expected.filter((fieldId) =>
    values.some((value) => value.fieldId === fieldId && hasValue(value.value)),
  );
  const missing = expected.filter((fieldId) => !extracted.includes(fieldId));
  const lowConfidence = expected.filter((fieldId) =>
    values.some(
      (value) =>
        value.fieldId === fieldId &&
        hasValue(value.value) &&
        value.confidence < LOW_CRITICAL_CONFIDENCE_THRESHOLD,
    ),
  );
  const ambiguous = expected.filter((fieldId) =>
    conflictedFields.some((conflict) => conflict === fieldId || conflict.startsWith(`${fieldId}::`)),
  );
  return {
    source,
    status: unreadable ? "FAILED" : missing.length || lowConfidence.length || ambiguous.length ? "PARTIAL" : "COMPLETE",
    expectedCriticalFields: expected,
    extractedCriticalFields: extracted,
    missingCriticalFields: missing,
    lowConfidenceCriticalFields: lowConfidence,
    ambiguousCriticalFields: ambiguous,
    recoveredFields: [...new Set(recoveredFields.filter((fieldId) => expected.includes(fieldId)))],
    deterministicFields: [...new Set(deterministicFields.filter((fieldId) => expected.includes(fieldId)))],
    coverage: Math.round((extracted.length / expected.length) * 100),
  };
}

function hasValue(value: string | number | null | undefined) {
  return value != null && String(value).trim().length > 0;
}
