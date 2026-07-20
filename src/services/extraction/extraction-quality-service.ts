import type {
  ChecklistField,
  DocumentSource,
  ExtractedFieldValue,
  ExtractionQualityReport,
  ProviderExtractionOutput,
} from "@/domain/validation";
import { normalizeValue } from "@/services/normalization/normalization-service";

const LOW_CRITICAL_CONFIDENCE_THRESHOLD = 75;

const criticalFieldsBySource: Partial<Record<DocumentSource, string[]>> = {
  MINUTA: [
    "contract.number",
    "contract.date",
    "contract.agencyCode",
    "contract.financingModality",
    "contract.housingProgram",
    "buyer.name",
    "buyer.cpf",
    "buyer.rg",
    "buyer.maritalStatus",
    "buyer.address",
    "property.iptu",
    "property.development",
    "property.registration",
    "property.unit",
    "property.tower",
    "financial.downPayment",
    "financial.financing",
    "financial.totalValue",
    "financial.appraisalValue",
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
    "property.iptu",
  ],
  DADOS_RESERVA: [
    "buyer.name",
    "buyer.cpf",
    "buyer.rg",
    "buyer.maritalStatus",
    "buyer.address",
    "buyer.email",
    "buyer.phone",
    "property.development",
    "property.registration",
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
  FRACOES: ["property.iptu", "property.privateArea"],
  IPTU: ["property.iptu"],
};

export function criticalChecklistFields(source: DocumentSource, checklist: ChecklistField[]) {
  const expected = new Set(criticalFieldsBySource[source] ?? []);
  // Coverage is source-specific. A reservation screen, for example, must not be
  // penalized for omitting the seller's phone or data that only exists in an ITBI.
  return checklist.filter((field) => expected.has(field.id));
}

export function validateCriticalEvidence(source: DocumentSource, output: ProviderExtractionOutput, checklist: ChecklistField[]) {
  const critical = new Set(
    checklist
      .filter((field) => criticalChecklistFields(source, checklist).some((criticalField) => criticalField.id === field.id) || requiresEvidence(field.id))
      .map((field) => field.id),
  );
  const evidenceIssues = output.fields
    .filter((field) => critical.has(field.fieldId) && hasValue(field.value))
    .filter((field) => {
      const definition = checklist.find((item) => item.id === field.fieldId);
      const rawText = field.sourceLocation?.rawText?.trim();
      return !definition || !rawText ||
        !evidenceContainsValue(String(field.value), rawText, definition.fieldType) ||
        !hasExpectedMinutaFinancialEvidence(source, field.fieldId, rawText);
    })
    .map((field) => field.participantId ? `${field.fieldId}::${field.participantId}` : field.fieldId);
  const invalid = new Set(evidenceIssues);
  return {
    output: {
      fields: output.fields.map((field) => {
        const key = field.participantId ? `${field.fieldId}::${field.participantId}` : field.fieldId;
        return invalid.has(key) ? { ...field, value: null, confidence: 0, sourceLocation: undefined } : field;
      }),
    },
    evidenceIssues: [...new Set(evidenceIssues)],
  };
}

function hasExpectedMinutaFinancialEvidence(source: DocumentSource, fieldId: string, rawText: string) {
  if (source !== "MINUTA") return true;

  const compact = rawText.replace(/\s+/g, " ");
  const item = (number: string) => new RegExp(`B\\s*\\.?\\s*4\\s*\\.?\\s*${number}\\b`, "i").test(compact);
  const acquisitionItem = (number: string) => new RegExp(`B\\s*1\\s*\\.?\\s*${number}\\b`, "i").test(compact);

  if (fieldId === "financial.financing") {
    return (item("1") && /valor\s+do\s+financiamento(?:\s+concedido\s+pela\s+caixa)?/i.test(compact)) ||
      (acquisitionItem("3") && /financiamento\s+concedido\s+pela\s+caixa/i.test(compact));
  }
  if (fieldId === "financial.downPayment" || fieldId === "financial.housingEntry") {
    return (item("2") || acquisitionItem("1")) && /recursos\s+pr[oó]prios/i.test(compact);
  }
  if (fieldId === "financial.fgts") {
    return (item("3") || acquisitionItem("2")) && /fgts/i.test(compact);
  }
  if (fieldId === "financial.subsidy") {
    return item("5") && /(?:desconto|subs[ií]dio)/i.test(compact);
  }
  if (fieldId === "financial.totalValue") {
    return /valor\s+destinado\s+[àa]\s+aquisi[cç][aã]o|valor\s+do\s+contrato|valor\s+de\s+aquisi[cç][aã]o[^.]*?equivale/i.test(compact);
  }
  return true;
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
  details: Pick<ExtractionQualityReport, "error" | "extractionMethod" | "evidenceIssues"> = {},
): ExtractionQualityReport {
  const expected = criticalChecklistFields(source, checklist).map((field) => field.id);
  if (!expected.length) {
    return {
      source,
      status: unreadable ? "FAILED" : "NOT_ASSESSED",
      error: details.error,
      extractionMethod: details.extractionMethod,
      expectedCriticalFields: [],
      extractedCriticalFields: [],
      missingCriticalFields: [],
      lowConfidenceCriticalFields: [],
      ambiguousCriticalFields: [],
      evidenceIssues: [],
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
    status: unreadable ? "FAILED" : missing.length || lowConfidence.length || ambiguous.length || (details.evidenceIssues?.length ?? 0) ? "PARTIAL" : "COMPLETE",
    error: details.error,
    extractionMethod: details.extractionMethod,
    expectedCriticalFields: expected,
    extractedCriticalFields: extracted,
    missingCriticalFields: missing,
    lowConfidenceCriticalFields: lowConfidence,
    ambiguousCriticalFields: ambiguous,
    evidenceIssues: details.evidenceIssues ?? [],
    recoveredFields: [...new Set(recoveredFields.filter((fieldId) => expected.includes(fieldId)))],
    deterministicFields: [...new Set(deterministicFields.filter((fieldId) => expected.includes(fieldId)))],
    coverage: Math.round((extracted.length / expected.length) * 100),
  };
}

function hasValue(value: string | number | null | undefined) {
  return value != null && String(value).trim().length > 0;
}

function requiresEvidence(fieldId: string) {
  return fieldId.startsWith("financial.") || [
    "buyer.name",
    "buyer.cpf",
    "buyer.rg",
    "buyer.address",
    "buyer.email",
    "buyer.phone",
    "seller.legalName",
    "seller.cnpj",
  ].includes(fieldId);
}

function evidenceContainsValue(value: string, evidence: string, fieldType: ChecklistField["fieldType"]) {
  const normalizedValue = normalizeValue(value, fieldType);
  if (!normalizedValue) return false;
  if (["cpf", "cnpj", "rg", "telefone"].includes(fieldType)) return evidence.replace(/\D/g, "").includes(normalizedValue);
  if (fieldType === "valor_monetario" || fieldType === "area") {
    return [...evidence.matchAll(/\d[\d.,]*/g)].some((match) => normalizeValue(match[0], fieldType) === normalizedValue);
  }
  if (fieldType === "email") return evidence.toLowerCase().includes(normalizedValue);
  const tokens = normalizedValue.split(/\s+/).filter((token) => token.length > 2);
  const normalizedEvidence = normalizeValue(evidence, fieldType);
  return tokens.length > 0 && tokens.filter((token) => normalizedEvidence.includes(token)).length / tokens.length >= 0.6;
}
