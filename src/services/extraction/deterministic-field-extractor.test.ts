import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import { extractDeterministicFields } from "./deterministic-field-extractor";

test("extrai composição financeira padronizada da minuta sem depender da IA", () => {
  const output = extractDeterministicFields(
    [
      "B.4.1 - Valor do financiamento concedido pela CAIXA: R$ 114.616,91",
      "B.4.2 - Recursos próprios: R$ 50.607,09",
      "B.4.3 - Recursos da conta vinculada do FGTS: R$ 0,00",
      "B.4.5 - Desconto/subsídio: R$ 51.776,00",
      "O valor destinado ao pagamento da compra e venda é R$ 237.000,00.",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "financial.financing"), "R$ 114.616,91");
  assert.equal(value(output, "financial.downPayment"), "R$ 50.607,09");
  assert.equal(value(output, "financial.fgts"), "R$ 0,00");
  assert.equal(value(output, "financial.subsidy"), "R$ 51.776,00");
  assert.equal(value(output, "financial.totalValue"), "R$ 237.000,00");
});

test("extrai dados principais da tela de reserva", () => {
  const output = extractDeterministicFields(
    [
      "Unidade:",
      "VITÓRIA MARACANAÚ / TORRE 23 / 103 /Matrícula: 6426",
      "Cliente:",
      "GABRIEL BARROS ARAGAO SILVA",
      "Telefone:",
      "+558599875252",
      "E-mail:",
      "pessoalgabrielbarros@gmail.com",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "DADOS_RESERVA",
  );

  assert.equal(value(output, "property.tower"), "23");
  assert.equal(value(output, "property.unit"), "103");
  assert.equal(value(output, "property.registration"), "6426");
  assert.equal(value(output, "buyer.phone"), "+558599875252");
  assert.equal(value(output, "buyer.email"), "pessoalgabrielbarros@gmail.com");
});

test("extrai campos financeiros de print de pagamento incluindo opcionais", () => {
  const output = extractDeterministicFields(
    [
      "Valor do contrato: R$ 237.000,00",
      "Financiamento: R$ 114.616,91",
      "FGTS: R$ 12.000,00",
      "Subsídio: R$ 51.776,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "DADOS_RESERVA",
  );

  assert.equal(value(output, "financial.totalValue"), "R$ 237.000,00");
  assert.equal(value(output, "financial.financing"), "R$ 114.616,91");
  assert.equal(value(output, "financial.fgts"), "R$ 12.000,00");
  assert.equal(value(output, "financial.subsidy"), "R$ 51.776,00");
});

function value(output: ReturnType<typeof extractDeterministicFields>, fieldId: string) {
  return output.fields.find((field) => field.fieldId === fieldId)?.value;
}
