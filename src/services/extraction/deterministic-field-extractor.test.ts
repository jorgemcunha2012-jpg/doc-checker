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

test("extrai dados do cliente da reserva quando o valor vem abaixo do rótulo", () => {
  const output = extractDeterministicFields(
    [
      "NOME DO CLIENTE",
      "NYASHI DE OLIVEIRA NUNES",
      "CPF / CNPJ",
      "078.223.613-84",
      "RG",
      "07165783729",
      "CELULAR",
      "+5585986923999",
      "E-MAIL",
      "nyashi.nunes18@gmail.com",
      "ESTADO CIVIL",
      "Solteiro(a)",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "DADOS_RESERVA",
  );

  assert.equal(value(output, "buyer.name"), "NYASHI DE OLIVEIRA NUNES");
  assert.equal(value(output, "buyer.cpf"), "078.223.613-84");
  assert.equal(value(output, "buyer.rg"), "07165783729");
  assert.equal(value(output, "buyer.phone"), "+5585986923999");
  assert.equal(value(output, "buyer.email"), "nyashi.nunes18@gmail.com");
  assert.equal(value(output, "buyer.maritalStatus"), "Solteiro(a)");
});

test("monta endereço residencial do cliente a partir dos rótulos da reserva", () => {
  const output = extractDeterministicFields(
    [
      "ENDEREÇO",
      "Rua Otávio Alves",
      "NÚMERO",
      "102",
      "COMPLEMENTO",
      "-",
      "BAIRRO",
      "Pajuçara",
      "CIDADE",
      "Maracanaú",
      "ESTADO",
      "Ceará",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "DADOS_RESERVA",
  );

  assert.equal(value(output, "buyer.address"), "Rua Otávio Alves, 102, Pajuçara, Maracanaú, Ceará");
});

test("extrai financiamento e subsídio de tabela de condição de pagamento", () => {
  const output = extractDeterministicFields(
    [
      "Valor do contrato: R$ 216.000,00",
      "Série Parcelas Valor Subtotal",
      "Financiamento 1 R$ 172.800,00 R$ 172.800,00 R$ 0,00 R$ 172.800,00",
      "Subsídio 1 R$ 4.183,00 R$ 4.183,00 R$ 0,00 R$ 4.183,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "DADOS_RESERVA",
  );

  assert.equal(value(output, "financial.totalValue"), "R$ 216.000,00");
  assert.equal(value(output, "financial.financing"), "R$ 172.800,00");
  assert.equal(value(output, "financial.subsidy"), "R$ 4.183,00");
});

function value(output: ReturnType<typeof extractDeterministicFields>, fieldId: string) {
  return output.fields.find((field) => field.fieldId === fieldId)?.value;
}
