import type {
  ChecklistField,
  DocumentSource,
  ExtractedFieldValue,
  ExtractionQualityReport,
  FieldComparisonResult,
  LearnedEquivalenceRule,
  ReconciliationRun,
  ReconciliationSourceValue,
} from "@/domain/validation";
import { documentSourceLabels } from "@/domain/validation";
import { getChecklist } from "@/domain/checklists";
import { acceptedEquivalenceObservation, normalizeFieldValue } from "@/services/validation/supervised-learning-service";

const LOW_CONFIDENCE_THRESHOLD = 70;
const SIMILAR_TEXT_THRESHOLD = 0.86;

export type ReconciliationInput = {
  values: ExtractedFieldValue[];
  participatingSources: DocumentSource[];
  unreadableSources: DocumentSource[];
  sourceErrors: Partial<Record<DocumentSource, string>>;
  conflictedFieldsBySource: Partial<Record<DocumentSource, string[]>>;
  qualityBySource?: Partial<Record<DocumentSource, ExtractionQualityReport>>;
  learnedEquivalences?: LearnedEquivalenceRule[];
  usedPdfVisionFallback: boolean;
};

export class ReconciliationEngine {
  run(organizationId: string, input: ReconciliationInput): ReconciliationRun {
    const checklist = expandParticipantFields(
      getChecklist("RECONCILIATION").filter((field) => field.itemType === "COMPARISON"),
      input.values,
    );
    const results = checklist
      .filter((field) => this.hasEvidenceForField(field, input))
      .map((field) => this.compareField(organizationId, field, input));

    const missingBySource = Object.fromEntries(
      input.participatingSources.map((source) => [
        source,
        results.filter((result) =>
          result.observation.includes(`não encontrado na fonte ${documentSourceLabels[source]}`),
        ).length,
      ]),
    );
    const unreadableBySource = Object.fromEntries(
      input.participatingSources.map((source) => [
        source,
        results.filter((result) => result.status === "SOURCE_UNREADABLE" && result.valuesBySource[source]).length,
      ]),
    );

    return {
      id: crypto.randomUUID(),
      organizationId,
      validationType: "RECONCILIATION",
      checklist,
      results,
      participatingSources: input.participatingSources,
      extractionQualityBySource: input.qualityBySource,
      usedPdfVisionFallback: input.usedPdfVisionFallback,
      summary: {
        totalChecked: results.length,
        matches: results.filter((result) => result.status === "MATCH").length,
        divergences: results.filter((result) => result.status === "DIVERGENCE").length,
        reviewRequired: results.filter((result) => result.status === "REVIEW_REQUIRED").length,
        unreadable: results.filter((result) => result.status === "SOURCE_UNREADABLE").length,
        missingBySource,
        unreadableBySource,
      },
    };
  }

  private hasEvidenceForField(field: ChecklistField, input: ReconciliationInput) {
    if (isOptionalPaymentPrintResourceField(field, input)) {
      return hasFilledValueFromSource(field, input.values, "DADOS_RESERVA");
    }
    return input.participatingSources.some((source) => field.expectedSources?.includes(source)) ||
      input.values.some((value) => matchesFieldValue(value, field));
  }

  private compareField(
    organizationId: string,
    field: ChecklistField,
    input: ReconciliationInput,
  ): FieldComparisonResult {
    const evidenceParticipants = input.participatingSources.filter((source) =>
      input.values.some((value) => matchesFieldValue(value, field) && value.source === source),
    );
    const comparisonParticipants = input.participatingSources.filter((source) =>
      input.values.some(
        (value) =>
          matchesFieldValue(value, field) &&
          value.source === source &&
          value.value != null &&
          String(value.value).trim().length > 0,
      ),
    );
    const valuesBySource: Partial<Record<DocumentSource, ReconciliationSourceValue>> = {};

    for (const source of evidenceParticipants) {
      const extracted = input.values.find((value) => matchesFieldValue(value, field) && value.source === source);
      const rawValue = extracted?.value == null ? null : String(extracted.value).trim();
      valuesBySource[source] = {
        value: rawValue || null,
        normalizedValue: normalizeFieldValue(rawValue ?? "", field),
        confidence: extracted?.confidence ?? 0,
        sourceLocation: extracted?.sourceLocation,
      };
    }

    const conflictId = field.participantId ? `${field.baseFieldId ?? field.id}::${field.participantId}` : field.id;
    const conflicts = comparisonParticipants.filter((source) => input.conflictedFieldsBySource[source]?.includes(conflictId));
    if (conflicts.length) {
      return result(
        organizationId,
        field,
        valuesBySource,
        "REVIEW_REQUIRED",
        `Foram encontrados valores conflitantes entre arquivos da fonte ${joinSources(conflicts)}.`,
      );
    }

    const unreadableExpectedSources = input.unreadableSources.filter((source) => field.expectedSources?.includes(source));
    if (unreadableExpectedSources.length) {
      return result(
        organizationId,
        field,
        valuesBySource,
        "SOURCE_UNREADABLE",
        `Campo não pôde ser conferido completamente porque a fonte ${joinSources(unreadableExpectedSources)} não foi interpretada.${sourceErrorDetails(unreadableExpectedSources, input)}`,
      );
    }

    if (comparisonParticipants.length < 2) {
      const expectedParticipants = input.participatingSources.filter((source) => field.expectedSources?.includes(source));
      const acceptedObservation = acceptedEquivalenceObservation(
        field,
        valuesBySource,
        expectedParticipants.length ? expectedParticipants : input.participatingSources,
        input.learnedEquivalences,
      );
      if (acceptedObservation) {
        return result(organizationId, field, valuesBySource, "MATCH", acceptedObservation);
      }
      const expectedMissingSources = input.participatingSources.filter(
        (source) =>
          field.expectedSources?.includes(source) &&
          !comparisonParticipants.includes(source) &&
          !input.unreadableSources.includes(source),
      );
      const missingMessage = expectedMissingSources.length
        ? ` Campo não encontrado na fonte ${joinSources(expectedMissingSources)}.`
        : "";
      return result(
        organizationId,
        field,
        valuesBySource,
        "REVIEW_REQUIRED",
        comparisonParticipants.length
          ? `Campo encontrado apenas na fonte ${joinSources(comparisonParticipants)}. É necessário outro arquivo com o mesmo dado para confirmar.${missingMessage}`
          : `Campo não encontrado nas fontes esperadas para conferência.${missingMessage}`,
      );
    }

    const lowConfidence = comparisonParticipants.filter((source) => (valuesBySource[source]?.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD);
    if (lowConfidence.length) {
      return result(
        organizationId,
        field,
        valuesBySource,
        "REVIEW_REQUIRED",
        `Extração abaixo de ${LOW_CONFIDENCE_THRESHOLD}% na fonte ${joinSources(lowConfidence)}.`,
      );
    }

    const groups = groupByNormalizedValue(comparisonParticipants, valuesBySource);
    if (groups.length === 1) {
      const rawValues = comparisonParticipants.map((source) => valuesBySource[source]?.value ?? "");
      const observation = new Set(rawValues).size > 1 ? "Valores equivalentes após normalização." : "Todas as fontes conferem.";
      return result(organizationId, field, valuesBySource, "MATCH", observation);
    }

    const acceptedObservation = acceptedEquivalenceObservation(
      field,
      valuesBySource,
      comparisonParticipants,
      input.learnedEquivalences,
    );
    if (acceptedObservation) {
      return result(organizationId, field, valuesBySource, "MATCH", acceptedObservation);
    }

    if (isTextual(field) && allDifferencesAreSmall(comparisonParticipants, valuesBySource)) {
      addDiffTokens(comparisonParticipants, valuesBySource);
      return result(
        organizationId,
        field,
        valuesBySource,
        "REVIEW_REQUIRED",
        `Há pequena diferença textual entre ${joinSources(comparisonParticipants)}; confirme os valores destacados.`,
      );
    }

    addDiffTokens(comparisonParticipants, valuesBySource);
    return result(organizationId, field, valuesBySource, "DIVERGENCE", buildSourceDiagnostic(groups));
  }
}

function isOptionalPaymentPrintResourceField(field: ChecklistField, input: ReconciliationInput) {
  const fieldId = field.baseFieldId ?? field.id;
  return (fieldId === "financial.fgts" || fieldId === "financial.subsidy") &&
    input.participatingSources.includes("DADOS_RESERVA");
}

function hasFilledValueFromSource(field: ChecklistField, values: ExtractedFieldValue[], source: DocumentSource) {
  return values.some(
    (value) =>
      matchesFieldValue(value, field) &&
      value.source === source &&
      value.value != null &&
      String(value.value).trim().length > 0,
  );
}

function expandParticipantFields(checklist: ChecklistField[], values: ExtractedFieldValue[]) {
  const participantIds = [...new Set(values.map((value) => value.participantId).filter((value): value is string => Boolean(value)))];
  if (!participantIds.length) return checklist;

  const participantNames = new Map(
    participantIds.map((participantId, index) => {
      const name = values.find(
        (value) => value.participantId === participantId && value.fieldId === "buyer.name" && value.value,
      )?.value;
      return [participantId, name ? String(name) : `Comprador ${index + 1}`];
    }),
  );

  const repeatedFields = checklist.filter((field) => field.allowMultiple);
  const identificationFields = checklist.filter((field) => !field.allowMultiple && field.category === "Identificação do contrato");
  const remainingFields = checklist.filter((field) => !field.allowMultiple && field.category !== "Identificação do contrato");
  const participantFields = participantIds.flatMap((participantId) =>
    repeatedFields.map((field) => ({
      ...field,
      id: `${field.id}::${participantId}`,
      baseFieldId: field.id,
      participantId,
      participantLabel: participantNames.get(participantId),
      label: `${field.label} · ${participantNames.get(participantId)}`,
    })),
  );
  return [...identificationFields, ...participantFields, ...remainingFields];
}

function matchesFieldValue(value: ExtractedFieldValue, field: ChecklistField) {
  return value.fieldId === (field.baseFieldId ?? field.id) &&
    (!field.participantId || value.participantId === field.participantId);
}

function result(
  organizationId: string,
  field: ChecklistField,
  valuesBySource: Partial<Record<DocumentSource, ReconciliationSourceValue>>,
  status: FieldComparisonResult["status"],
  observation: string,
): FieldComparisonResult {
  return { organizationId, field, valuesBySource, status, observation };
}

function groupByNormalizedValue(
  sources: DocumentSource[],
  valuesBySource: Partial<Record<DocumentSource, ReconciliationSourceValue>>,
) {
  const groups = new Map<string, DocumentSource[]>();
  for (const source of sources) {
    const normalized = valuesBySource[source]?.normalizedValue ?? "";
    groups.set(normalized, [...(groups.get(normalized) ?? []), source]);
  }
  return [...groups.entries()].map(([value, sourcesInGroup]) => ({ value, sources: sourcesInGroup }));
}

function buildSourceDiagnostic(groups: Array<{ value: string; sources: DocumentSource[] }>) {
  const isolated = groups.find((group) => group.sources.length === 1);
  const majority = groups.find((group) => group.sources.length > 1);
  if (isolated && majority) {
    return `Valor divergente apenas na fonte ${documentSourceLabels[isolated.sources[0]]}. ${joinSources(majority.sources)} apresentam valores equivalentes.`;
  }
  return `Valores divergentes entre as fontes: ${groups.map((group) => joinSources(group.sources)).join("; ")}.`;
}

function isTextual(field: ChecklistField) {
  return field.fieldType === "texto" || field.fieldType === "endereco";
}

function allDifferencesAreSmall(
  sources: DocumentSource[],
  valuesBySource: Partial<Record<DocumentSource, ReconciliationSourceValue>>,
) {
  const values = sources.map((source) => valuesBySource[source]?.normalizedValue ?? "");
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      if (similarity(values[left], values[right]) < SIMILAR_TEXT_THRESHOLD) {
        return false;
      }
    }
  }
  return true;
}

function similarity(left: string, right: string) {
  const longest = Math.max(left.length, right.length);
  if (!longest) return 1;
  return 1 - levenshtein(left, right) / longest;
}

function levenshtein(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 0; column <= right.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
  }
  return rows[left.length][right.length];
}

function addDiffTokens(
  sources: DocumentSource[],
  valuesBySource: Partial<Record<DocumentSource, ReconciliationSourceValue>>,
) {
  const tokenFrequency = new Map<string, number>();
  for (const source of sources) {
    const uniqueTokens = new Set(tokenize(valuesBySource[source]?.normalizedValue ?? ""));
    uniqueTokens.forEach((token) => tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1));
  }
  for (const source of sources) {
    const value = valuesBySource[source];
    if (value) value.diffTokens = tokenize(value.normalizedValue).filter((token) => tokenFrequency.get(token) !== sources.length);
  }
}

function tokenize(value: string) {
  return value.split(/\s+/).filter(Boolean);
}

function joinSources(sources: DocumentSource[]) {
  return new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" }).format(
    sources.map((source) => documentSourceLabels[source]),
  );
}

function sourceErrorDetails(sources: DocumentSource[], input: ReconciliationInput) {
  const messages = sources.flatMap((source) => {
    const error = input.sourceErrors[source] ?? input.qualityBySource?.[source]?.error;
    return error ? [` ${documentSourceLabels[source]}: ${error}`] : [];
  });
  return messages.length ? ` Motivo:${messages.join("")}` : "";
}
