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

test("extrai área do terreno quando o contrato informa o valor na descrição do terreno", () => {
  const output = extractDeterministicFields(
    "D1 - O terreno possui 22.688,71m² de área total, constituído de 30 torres.",
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "property.terrainArea"), "22.688,71m²");
  assert.equal(value(output, "property.landArea"), "22.688,71m²");
});

test("aceita variações do rótulo de área do terreno no ITBI", () => {
  const output = extractDeterministicFields(
    "Área do terreno (m²): 180,00",
    getChecklist("RECONCILIATION"),
    "ITBI",
  );

  assert.equal(value(output, "property.landArea"), "180,00");
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

test("extrai campos de ITBI preenchível a partir dos campos de formulário do PDF", () => {
  const output = extractDeterministicFields(
    [
      "[CAMPOS DE FORMULARIO]",
      "Texto1: FRANCISCO JOSE MARQUES DOS SANTOS28780619851",
      "Endereço: R CORONEL CHICO ALVES, 21 APT 407 T 01 - PASSARE CEP 60744050 FORTALEZA/CE",
      "Email_4: MARQUESFRANCISCOJOSE79@GMAIL.COM",
      "Texto2: VICTA 07 EMPREENDIMENTOS IMOBILIARIOS SPE S.A.",
      "Texto3: 44.537.507/0001-54",
      "Texto6: 1017539-3",
      "Endereço_2: R BENVINDA",
      "Complemento: APT 1205 TORRE 02",
      "Área privativa m²: 48,95m²",
      "Área comum m²: 37,338423m²",
      "Área total m²: 86,288423m²",
      "Fração ideal: 0,003699811434",
      "Valor financiado SFH: 271.704,42",
      "Valor não financiado: 78.295,58",
      "VALOR TOTAL DECLARADO: 350.000,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "ITBI",
  );

  assert.equal(value(output, "buyer.name"), "FRANCISCO JOSE MARQUES DOS SANTOS");
  assert.equal(value(output, "buyer.cpf"), "28780619851");
  assert.equal(value(output, "seller.cnpj"), "44.537.507/0001-54");
  assert.equal(value(output, "property.unit"), "1205");
  assert.equal(value(output, "property.tower"), "02");
  assert.equal(value(output, "financial.financing"), "271.704,42");
  assert.equal(value(output, "financial.totalValue"), "350.000,00");
});

test("extrai DTI preenchível mesmo quando os rótulos vêm como Text e CPFCNPJ", () => {
  const output = extractDeterministicFields(
    [
      "Nome: JOAO ERIC ANTONIO BEZERRA OLIVEIRA /LARISSA FERREIRA DOS SANTOS",
      "CPFCNPJ: 028.349.913-32/ 074.805.813-35",
      "Telefone: (85) 99793-2496",
      "Endereço: R Pedro Macário, 151, Tabuba em Caucaia/CE",
      "Email: jeric.oliveira@gmail.com",
      "Text1: SPE CAUCAIA CT EMPREENDIMENTOS IMOBILIARIOS LTDA",
      "Text2: 53.635.373/0001-03",
      "Endereço_2: RUA GENERAL SAMPAIO, 835 - SALA 301, CENTRO, FORTALEZA/CE",
      "Inscrição do IPTU: 147158-9",
      "Text3: RUA TABUZIOS, TABUBA, CAUCAIA/CE",
      "Text8: 70",
      "Text6: Apartamento",
      "Text4: 69465",
      "Área do terreno m²: 10.006,00",
      "Área privativa m²: 48,19m²",
      "Área comum m²: 41,524337m²",
      "Área total m²: 89,714337m²",
      "Complemento: T3 , AP 201",
      "Compra Venda etc: COMPRA E VENDA",
      "Valor Financiado: 360.000,00",
      "Valor Não Financiado: 55.000,00",
      "Valor Total Declarado: 415.000,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "ITBI",
  );

  assert.equal(value(output, "buyer.name"), "JOAO ERIC ANTONIO BEZERRA OLIVEIRA /LARISSA FERREIRA DOS SANTOS");
  assert.equal(value(output, "buyer.cpf"), "028.349.913-32");
  assert.equal(value(output, "seller.legalName"), "SPE CAUCAIA CT EMPREENDIMENTOS IMOBILIARIOS LTDA");
  assert.equal(value(output, "seller.cnpj"), "53.635.373/0001-03");
  assert.equal(value(output, "property.iptu"), "147158-9");
  assert.equal(value(output, "property.registration"), "69465");
  assert.equal(value(output, "property.address"), "RUA TABUZIOS, TABUBA, CAUCAIA/CE");
  assert.equal(value(output, "property.tower"), "3");
  assert.equal(value(output, "property.unit"), "201");
  assert.equal(value(output, "property.landArea"), "10.006,00");
  assert.equal(value(output, "financial.financing"), "360.000,00");
  assert.equal(value(output, "financial.nonFinancedValue"), "55.000,00");
});

test("reconhece o formato DTI pelo conteúdo mesmo se a fonte vier classificada diferente", () => {
  const output = extractDeterministicFields(
    [
      "DECLARAÇÃO DE TRANSAÇÃO IMOBILIÁRIA - DTI",
      "[CAMPOS DE FORMULARIO]",
      "Nome: JOAO ERIC ANTONIO BEZERRA OLIVEIRA",
      "Área do terreno m²: 10.006,00",
      "Text4: 69465",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "buyer.name"), "JOAO ERIC ANTONIO BEZERRA OLIVEIRA");
  assert.equal(value(output, "property.landArea"), "10.006,00");
  assert.equal(value(output, "property.registration"), "69465");
});

test("extrai razão social e CNPJ da matrícula para confronto com a minuta", () => {
  const output = extractDeterministicFields(
    [
      "Proprietária: VICTA 07 EMPREENDIMENTOS IMOBILIARIOS SPE S.A.",
      "CNPJ: 44.537.507/0001-54",
      "Matrícula 91849",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "MATRICULA",
  );

  assert.equal(value(output, "seller.legalName"), "VICTA 07 EMPREENDIMENTOS IMOBILIARIOS SPE S.A");
  assert.equal(value(output, "seller.cnpj"), "44.537.507/0001-54");
});

function value(output: ReturnType<typeof extractDeterministicFields>, fieldId: string) {
  return output.fields.find((field) => field.fieldId === fieldId)?.value;
}
