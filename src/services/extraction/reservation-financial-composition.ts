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
) {
  const byId = new Map(output.fields.map((field) => [field.fieldId, field]));
  const total = money(byId.get("financial.totalValue")?.value);
  const financing = money(byId.get("financial.financing")?.value);
  const fgts = money(byId.get("financial.fgts")?.value) ?? 0;
  const subsidy = money(byId.get("financial.subsidy")?.value) ?? 0;
  const currentEntry = byId.get("financial.downPayment");

  if (total == null || financing == null || hasExplicitOwnResources(currentEntry)) return output;

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
