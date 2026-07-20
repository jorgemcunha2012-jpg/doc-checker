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

test("não compara sinal isolado como entrada da composição dos recursos", () => {
  const checklist = getChecklist("RECONCILIATION");
  const output = {
    fields: [
      { fieldId: "financial.totalValue", value: "R$ 261.946,53", confidence: 98 },
      { fieldId: "financial.financing", value: "R$ 189.600,00", confidence: 98 },
      {
        fieldId: "financial.downPayment",
        value: "R$ 500,00",
        confidence: 98,
        sourceLocation: { section: "Condição de Pagamento", rawText: "Sinal 1 R$ 500,00" },
      },
    ],
  };

  const enriched = enrichReservationFinancialComposition(output, checklist);
  assert.equal(value(enriched, "financial.downPayment"), "R$ 72.346,53");
  assert.match(String(enriched.fields.find((field) => field.fieldId === "financial.downPayment")?.sourceLocation?.rawText), /Recursos próprios calculados/);
});

test("não calcula recursos próprios quando a tabela indica subsídio ainda não extraído", () => {
  const checklist = getChecklist("RECONCILIATION");
  const output = {
    fields: [
      { fieldId: "financial.totalValue", value: "R$ 216.000,00", confidence: 98 },
      { fieldId: "financial.financing", value: "R$ 172.800,00", confidence: 98 },
      {
        fieldId: "financial.downPayment",
        value: "R$ 499,95",
        confidence: 98,
        sourceLocation: { section: "Condição de Pagamento", rawText: "Sinal 1 R$ 499,95" },
      },
    ],
  };

  const enriched = enrichReservationFinancialComposition(output, checklist, "Sinal 1 R$ 499,95\nSubsídio 1 R$ 4.183,00");
  assert.equal(value(enriched, "financial.downPayment"), null);
});

test("calcula recursos próprios com todos os componentes da reserva, sem usar o sinal", () => {
  const checklist = getChecklist("RECONCILIATION");
  const output = extractDeterministicFields(
    [
      "Valor do contrato: R$ 216.000,00",
      "Sinal 1 R$ 499,95",
      "Financiamento 1 172.800,00 172.800,00",
      "Subsídio 1 4.183,00 4.183,00",
    ].join("\n"),
    checklist,
    "DADOS_RESERVA",
  );

  const enriched = enrichReservationFinancialComposition(
    output,
    checklist,
    "Sinal 1 R$ 499,95\nFinanciamento 1 172.800,00\nSubsídio 1 4.183,00",
  );

  assert.equal(value(enriched, "financial.downPayment"), "R$ 39.017,00");
  assert.match(String(enriched.fields.find((field) => field.fieldId === "financial.downPayment")?.sourceLocation?.rawText), /Subsídio: 4\.183,00/);
});

function value(output: { fields: Array<{ fieldId: string; value: string | null }> }, fieldId: string) {
  return output.fields.find((field) => field.fieldId === fieldId)?.value;
}
