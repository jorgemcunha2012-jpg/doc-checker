import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import { extractDeterministicFields } from "./deterministic-field-extractor";
import { enrichReservationFinancialComposition } from "./reservation-financial-composition";

test("recupera valores de tabela de reserva quando o OCR omite o símbolo de moeda", () => {
  const output = extractDeterministicFields(
    [
      "Valor do contrato: R$ 261.946,53",
      "Financiamento 1 189.600,00 189.600,00 000 189.600,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "DADOS_RESERVA",
  );

  const enriched = enrichReservationFinancialComposition(output, getChecklist("RECONCILIATION"));
  assert.equal(value(enriched, "financial.totalValue"), "R$ 261.946,53");
  assert.equal(value(enriched, "financial.financing"), "189.600,00");
  assert.equal(value(enriched, "financial.downPayment"), "R$ 72.346,53");
  assert.match(String(enriched.fields.find((field) => field.fieldId === "financial.downPayment")?.sourceLocation?.rawText), /72\.346,53/);
});

function value(output: { fields: Array<{ fieldId: string; value: string | null }> }, fieldId: string) {
  return output.fields.find((field) => field.fieldId === fieldId)?.value;
}
