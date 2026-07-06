import type {
  ChecklistField,
  DocumentSource,
  FieldComparisonResult,
  LearnedEquivalenceRule,
  ReconciliationSourceValue,
} from "@/domain/validation";
import { normalizeValue } from "@/services/normalization/normalization-service";

type RuleCandidate = Omit<LearnedEquivalenceRule, "organizationId" | "occurrenceCount">;

const optionalZeroFields = new Set(["financial.fgts", "financial.subsidy"]);
const developmentNoiseTokens = new Set(["CONDOMINIO", "CONDOMINIOCLUBE", "CLUBE", "RESIDENCIAL"]);

export function normalizeFieldValue(value: string, field: ChecklistField) {
  const normalized = normalizeValue(value, field.fieldType);
  const fieldId = baseFieldId(field);

  if (fieldId === "buyer.maritalStatus") {
    return normalizeMaritalStatus(normalized);
  }

  if (fieldId === "property.development") {
    return normalizeDevelopmentName(normalized);
  }

  return normalized;
}

export function acceptedEquivalenceObservation(
  field: ChecklistField,
  valuesBySource: Partial<Record<DocumentSource, ReconciliationSourceValue>>,
  sources: DocumentSource[],
  learnedRules: LearnedEquivalenceRule[] = [],
) {
  const candidate = buildRuleCandidate(field, valuesBySource, sources);
  if (!candidate) return null;

  if (candidate.ruleKind === "OPTIONAL_ZERO") {
    return "Valores equivalentes por regra segura: campo opcional sem valor foi tratado como R$ 0,00.";
  }

  const learned = learnedRules.find(
    (rule) =>
      rule.fieldId === candidate.fieldId &&
      rule.ruleKind === candidate.ruleKind &&
      rule.signature === candidate.signature,
  );

  if (learned) {
    return `Valores equivalentes por aprendizado supervisionado (${learned.occurrenceCount} validação${learned.occurrenceCount === 1 ? "" : "ões"} humana${learned.occurrenceCount === 1 ? "" : "s"} anterior${learned.occurrenceCount === 1 ? "" : "es"}).`;
  }

  if (candidate.ruleKind === "MARITAL_STATUS_GENDER") {
    return "Valores equivalentes: variação apenas gramatical do estado civil.";
  }

  if (candidate.ruleKind === "TEXT_ALIAS") {
    return "Valores equivalentes: variação textual já normalizada para este campo.";
  }

  return null;
}

export function buildApprovedEquivalenceRule(
  result: FieldComparisonResult,
): RuleCandidate | null {
  const sources = Object.keys(result.valuesBySource) as DocumentSource[];
  if (sources.length < 2) return null;
  return buildRuleCandidate(result.field, result.valuesBySource, sources);
}

export function equivalenceSignature(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort().join(" || ");
}

function buildRuleCandidate(
  field: ChecklistField,
  valuesBySource: Partial<Record<DocumentSource, ReconciliationSourceValue>>,
  sources: DocumentSource[],
): RuleCandidate | null {
  const fieldId = baseFieldId(field);
  const rawValues = sources.map((source) => valuesBySource[source]?.value ?? null);
  const rawNormalizedValues = rawValues.map((value) => normalizeValue(value ?? "", field.fieldType));
  const uniqueRawNormalized = [...new Set(rawNormalizedValues.filter(Boolean))];
  const normalizedValues = sources.map((source) => normalizeFieldValue(valuesBySource[source]?.value ?? "", field));

  if (uniqueRawNormalized.length <= 1 && !optionalZeroFields.has(fieldId)) return null;

  const examples = Object.fromEntries(sources.map((source) => [source, valuesBySource[source]?.value ?? null]));

  if (fieldId === "buyer.maritalStatus" && sameAfterMaritalGender(rawValues)) {
    return {
      fieldId,
      fieldType: field.fieldType,
      ruleKind: "MARITAL_STATUS_GENDER",
      signature: equivalenceSignature(rawNormalizedValues),
      normalizedValues: rawNormalizedValues.filter(Boolean),
      exampleValues: examples,
    };
  }

  if (fieldId === "property.development" && sameAfterDevelopmentAlias(rawValues)) {
    return {
      fieldId,
      fieldType: field.fieldType,
      ruleKind: "TEXT_ALIAS",
      signature: equivalenceSignature(rawNormalizedValues),
      normalizedValues: rawNormalizedValues.filter(Boolean),
      exampleValues: examples,
    };
  }

  if (optionalZeroFields.has(fieldId) && normalizedValues.every((value) => value === "" || value === "0.00")) {
    return {
      fieldId,
      fieldType: field.fieldType,
      ruleKind: "OPTIONAL_ZERO",
      signature: equivalenceSignature(["", "0.00"]),
      normalizedValues: ["", "0.00"],
      exampleValues: examples,
    };
  }

  return null;
}

function baseFieldId(field: ChecklistField) {
  return field.baseFieldId ?? field.id;
}

function sameAfterMaritalGender(values: Array<string | null>) {
  const canonical = values.map((value) => normalizeMaritalStatus(normalizeValue(value ?? "", "texto"))).filter(Boolean);
  return canonical.length >= 2 && new Set(canonical).size === 1;
}

function normalizeMaritalStatus(value: string) {
  return value
    .replace(/\bSOLTEIR[OA]\(A\)/g, "SOLTEIRO")
    .replace(/\bSOLTEIR[OA]\b/g, "SOLTEIRO")
    .replace(/\bCASAD[OA]\(A\)/g, "CASADO")
    .replace(/\bCASAD[OA]\b/g, "CASADO")
    .replace(/\bDIVORCIAD[OA]\(A\)/g, "DIVORCIADO")
    .replace(/\bDIVORCIAD[OA]\b/g, "DIVORCIADO")
    .replace(/\bVIUV[OA]\(A\)/g, "VIUVO")
    .replace(/\bVIUV[OA]\b/g, "VIUVO")
    .replace(/\s+/g, " ")
    .trim();
}

function sameAfterDevelopmentAlias(values: Array<string | null>) {
  const canonical = values.map((value) => normalizeDevelopmentName(normalizeValue(value ?? "", "texto"))).filter(Boolean);
  return canonical.length >= 2 && new Set(canonical).size === 1;
}

function normalizeDevelopmentName(value: string) {
  return value
    .split(/\s+/)
    .filter((token) => !developmentNoiseTokens.has(token))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
