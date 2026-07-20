import type { ChecklistField, ProviderExtractionOutput } from "@/domain/validation";
import { normalizeValue } from "@/services/normalization/normalization-service";

const financialFields = new Set([
  "financial.totalValue",
  "financial.downPayment",
  "financial.financing",
  "financial.fgts",
  "financial.subsidy",
]);

export function enrichReservationFinancialComposition(
  output: ProviderExtractionOutput,
  checklist: ChecklistField[],
  sourceText = "",
) {
  const byId = new Map(output.fields.map((field) => [field.fieldId, field]));
  const total = money(byId.get("financial.totalValue")?.value);
  const financing = money(byId.get("financial.financing")?.value);
  const fgts = money(byId.get("financial.fgts")?.value) ?? 0;
  const subsidy = money(byId.get("financial.subsidy")?.value) ?? 0;
  const currentEntry = byId.get("financial.downPayment");

  if (hasExplicitOwnResources(currentEntry)) return output;
  if (total == null || financing == null || hasUnresolvedFinancialComponent(sourceText, byId)) {
    return clearUnsafePartialEntry(output, currentEntry);
  }

  const entry = roundMoney(total - financing - fgts - subsidy);
  if (entry < 0) return output;

  const entryField = checklist.find((field) => field.id === "financial.downPayment");
  if (!entryField) return output;

  const totalValue = byId.get("financial.totalValue")?.value;
  const financingValue = byId.get("financial.financing")?.value;
  const fgtsValue = byId.get("financial.fgts")?.value;
  const subsidyValue = byId.get("financial.subsidy")?.value;
  const value = formatCurrency(entry);
  const rawText = [
    `Valor do contrato: ${totalValue}`,
    `Financiamento: ${financingValue}`,
    fgtsValue ? `FGTS: ${fgtsValue}` : null,
    subsidyValue ? `Subsídio: ${subsidyValue}` : null,
    `Recursos próprios calculados: ${value}`,
  ].filter(Boolean).join(" | ");

  return {
    fields: output.fields.map((field) =>
      field.fieldId === "financial.downPayment"
        ? {
            ...field,
            value,
            confidence: 88,
            sourceLocation: {
              section: "Composição calculada do print",
              rawText,
            },
          }
        : field,
    ),
  };
}

function hasUnresolvedFinancialComponent(text: string, fields: Map<string, ProviderExtractionOutput["fields"][number]>) {
  const normalized = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
  const hasValue = (fieldId: string) => Boolean(fields.get(fieldId)?.value);
  return (
    (/\bFGTS\b/.test(normalized) && !hasValue("financial.fgts")) ||
    (/\bSUBSIDIO\b|\bDESCONTO\b/.test(normalized) && !hasValue("financial.subsidy"))
  );
}

function clearUnsafePartialEntry(
  output: ProviderExtractionOutput,
  currentEntry: ProviderExtractionOutput["fields"][number] | undefined,
) {
  if (!currentEntry?.value || hasExplicitOwnResources(currentEntry)) return output;
  return {
    fields: output.fields.map((field) =>
      field.fieldId === "financial.downPayment"
        ? { ...field, value: null, confidence: 0, sourceLocation: undefined }
        : field,
    ),
  };
}

function hasExplicitOwnResources(field: ProviderExtractionOutput["fields"][number] | undefined) {
  if (!field?.value) return false;
  const evidence = field.sourceLocation?.rawText ?? "";
  return /recursos\s+pr[oó]prios|entrada\s+total/i.test(evidence) && !/\bsinal\b/i.test(evidence);
}

export function reservationFinancialFieldIds(output: ProviderExtractionOutput) {
  return output.fields
    .filter((field) => financialFields.has(field.fieldId) && field.value != null && String(field.value).trim())
    .map((field) => field.fieldId);
}

function money(value: string | null | undefined) {
  if (!value) return null;
  const normalized = normalizeValue(value, "valor_monetario");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}
