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

test("extrai composição B1 de minuta de aquisição e construção", () => {
  const output = extractDeterministicFields(
    [
      "O valor de aquisição da unidade habitacional objeto deste contrato equivale a R$ 424.098,99, a ser integralizado pelas parcelas abaixo:",
      "B1.1 Recursos próprios: | R$ 95.738,99",
      "B1.2 Recursos da conta vinculada do FGTS do(s) comprador(es): | R$ 0,00",
      "B1.3 Financiamento concedido pela CAIXA: | R$ 328.360,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "financial.totalValue"), "R$ 424.098,99");
  assert.equal(value(output, "financial.downPayment"), "R$ 95.738,99");
  assert.equal(value(output, "financial.fgts"), "R$ 0,00");
  assert.equal(value(output, "financial.financing"), "R$ 328.360,00");
});

test("extrai a data do contrato no bloco de assinaturas da minuta", () => {
  const output = extractDeterministicFields(
    "E por estarem de acordo, as partes assinam. FORTALEZA, CE 15 de Julho de 2026",
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "contract.date"), "15 de Julho de 2026");
});

test("prioriza o valor da tabela B.4 quando o DOCX preserva separadores de coluna", () => {
  const output = extractDeterministicFields(
    [
      "B.4 - VALOR DE COMPOSIÇÃO DOS RECURSOS:",
      "B.4.1 - Valor do financiamento concedido pela CAIXA: | R$ 189.600,00",
      "B.4.2 - Valor dos recursos próprios: | R$ 72.346,53",
      "B.4.3 - Valor dos recursos da conta vinculada de FGTS: | R$ 0,00",
      "B.4.5 - Valor do desconto complemento concedido pelo FGTS/União: | R$ 0,00",
      "sendo o valor da compra e venda do terreno: R$ 23.810,95",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "financial.financing"), "R$ 189.600,00");
  assert.equal(value(output, "financial.downPayment"), "R$ 72.346,53");
  assert.equal(value(output, "financial.fgts"), "R$ 0,00");
  assert.equal(value(output, "financial.subsidy"), "R$ 0,00");
});

test("associa valores agrupados aos itens B.4 quando o PDF separa rótulos e números", () => {
  const output = extractDeterministicFields(
    [
      "B.4.1 - Valor do financiamento concedido pela CAIXA:",
      "B.4.2 - Valor dos recursos próprios:",
      "B.4.3 - Valor dos recursos da conta vinculada de FGTS:",
      "B.4.4 - Valor da Cessão de Direitos Creditórios do FGTS Futuro, se houver:",
      "B.4. 5 - Valor do desconto complemento concedido pelo FGTS/União:",
      "R$ 158.384,70 R$ 43.334,35 R$ 4.035,95 R$ 0,00 R$ 18.245,00",
    ].join(" "),
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "financial.financing"), "R$ 158.384,70");
  assert.equal(value(output, "financial.downPayment"), "R$ 43.334,35");
  assert.equal(value(output, "financial.fgts"), "R$ 4.035,95");
  assert.equal(value(output, "financial.subsidy"), "R$ 18.245,00");
  assert.match(String(field(output, "financial.financing")?.sourceLocation?.rawText), /B\.4\.1.*158\.384,70/);
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

test("não trata unidade habitacional como número de apartamento", () => {
  const output = extractDeterministicFields(
    "A operação destina-se à aquisição de uma unidade habitacional integrante do empreendimento.",
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "property.unit"), null);
});

test("extrai apartamento e torre da redação de futura unidade autônoma da CAIXA", () => {
  const output = extractDeterministicFields(
    "Futura unidade autônoma Apartamento nº 404 da Torre 2",
    getChecklist("RECONCILIATION"),
    "MINUTA",
  );

  assert.equal(value(output, "property.unit"), "404");
  assert.equal(value(output, "property.tower"), "2");
  assert.match(String(field(output, "property.unit")?.sourceLocation?.rawText), /Apartamento nº 404/i);
  assert.match(String(field(output, "property.tower")?.sourceLocation?.rawText), /Apartamento nº 404 da Torre 2/i);
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

test("extrai dados pessoais de tela de reserva em grade", () => {
  const output = extractDeterministicFields(
    [
      "NOME DO CLIENTE CPF / CNPJ RG CELULAR",
      "MARIANA BERNARDINO ALVES 079.718.803-75 07723964953 +5585984057983",
      "TELEFONE E-MAIL PROFISSÃO",
      "+5585984057983 mariana.b.alves@gmail.com Analista de recursos humanos",
    ].join("\n"),
    getChecklist("RECONCILIATION"), "DADOS_RESERVA",
  );
  assert.equal(value(output, "buyer.name"), "MARIANA BERNARDINO ALVES");
  assert.equal(value(output, "buyer.cpf"), "079.718.803-75");
  assert.equal(value(output, "buyer.rg"), "07723964953");
  assert.equal(value(output, "buyer.phone"), "+5585984057983");
});

test("preserva os rótulos e valores financeiros da Reserva para validação de evidência", () => {
  const output = extractDeterministicFields(
    [
      "Valor do contrato: R$ 261.946,53",
      "Financiamento 1 R$ 189.600,00 R$ 189.600,00",
      "FGTS 1 R$ 0,00 R$ 0,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "DADOS_RESERVA",
  );

  assert.match(String(field(output, "financial.financing")?.sourceLocation?.rawText), /Financiamento/i);
  assert.match(String(field(output, "financial.totalValue")?.sourceLocation?.rawText), /Valor do contrato/i);
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

test("extrai valores financeiros da tabela de reserva mesmo quando o OCR mantém a coluna em uma linha", () => {
  const output = extractDeterministicFields(
    [
      "Valor do contrato: R$ 261.946,53",
      "Entrada 1 R$ 500,00 R$ 0,00 R$ 500,00",
      "Financiamento 1 R$ 189.600,00 R$ 189.600,00 R$ 0,00 R$ 189.600,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "DADOS_RESERVA",
  );

  assert.equal(value(output, "financial.totalValue"), "R$ 261.946,53");
  assert.equal(value(output, "financial.downPayment"), "R$ 500,00");
  assert.equal(value(output, "financial.financing"), "R$ 189.600,00");
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

test("delimita campos do DTI achatado e não aceita AP dentro de uma palavra", () => {
  const output = extractDeterministicFields(
    [
      "DECLARAÇÃO DE TRANSAÇÃO IMOBILIÁRIA DTI [CAMPOS DE FORMULARIO]",
      "Text1: SPE CAUCAIA CT EMPREENDIMENTOS IMOBILIARIOS LTDA",
      "Text2: 53.635.373/0001-03",
      "Endereço: R Pedro Macário, 151, Tabuba em Caucaia/CE Email: jeric.oliveira@gmail.com",
      "Endereço_2: RUA GENERAL SAMPAIO, 835 - SALA 301, CENTRO, FORTALEZA/CE",
      "Inscrição do IPTU: 147158-9 Text3: RUA TABUZIOS, TABUBA, CAUCAIA/CE",
      "Complemento: T3, AP 201 Compra Venda etc: COMPRA E VENDA Valor Financiado: 360.000,00",
    ].join(" "),
    getChecklist("RECONCILIATION"),
    "ITBI",
  );

  assert.equal(value(output, "seller.address"), "RUA GENERAL SAMPAIO, 835 - SALA 301, CENTRO, FORTALEZA/CE");
  assert.equal(value(output, "buyer.address"), "R Pedro Macário, 151, Tabuba em Caucaia/CE");
  assert.equal(value(output, "property.unit"), "201");
  assert.equal(value(output, "property.tower"), "3");
  assert.equal(value(output, "transaction.nature"), "COMPRA E VENDA");
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

test("lê DTI de Fortaleza com campos achatados e rótulos sem dois-pontos", () => {
  const output = extractDeterministicFields(
    [
      "DECLARAÇÃO TRANSMISSÃO IMOBILIÁRIA (DTI)",
      "DADOS DO ADQUIRENTE Nome DEIZIANE LEITE BARROS / JOSE NILTON PINHEIRO FILHO CPF/CPJ 03749079358 / 41557883300 Endereço RUA MINAS GERAIS, 1648, PANAMERICANO, FORTALEZA, CE Email LEITEBARROS@GMAIL.COM",
      "DADOS DO TRANSMITENTE Nome JOQUEI CLUBE EMPREENDIMENTOS IMOBILIARIOS SPE LTDA CPF/CNPJ 20.911.538/0001-65 Endereço RUA GENERAL SAMPAIO 835, CENTRO, FORTALEZA/CE",
      "NATUREZA DA TRANSAÇÃO COMPRA E VENDA DATA DO INSTRUMENTO 13/02/2026",
      "DADOS DO IMÓVEL OBJETO DA TRANSAÇÃO Inscrição do IPTU 1028037-5 Endereço PROFESSOR MANOEL LOURENÇO, JÓQUEI CLUBE - FORTALEZA/CE Número 1294 Complemento BL.T2 AP205 Tipo do imóvel APARTAMENTO Nº Matrícula 2391 Área do Terreno (m²) 10.957,49m² Área Privativa (m²) 48,95m² Área Comum (m²) 34,108800m² Área Total (m²) 83,058800m²",
      "DECLARAÇÃO DE VALORES DA TRANSAÇÃO IMOBILIÁRIA Valor não financiado R$ 140.898,50 Valor financiado (SFH) R$ 259.101,50 Valor TOTAL DECLARADO R$ 400.000,00 RESPONSÁVEL PELAS INFORMAÇÕES",
    ].join(" "),
    getChecklist("RECONCILIATION"),
    "ITBI",
  );

  assert.equal(value(output, "buyer.name"), "DEIZIANE LEITE BARROS / JOSE NILTON PINHEIRO FILHO");
  assert.equal(value(output, "seller.legalName"), "JOQUEI CLUBE EMPREENDIMENTOS IMOBILIARIOS SPE LTDA");
  assert.equal(value(output, "property.iptu"), "1028037-5");
  assert.equal(value(output, "property.registration"), "2391");
  assert.equal(value(output, "property.tower"), "2");
  assert.equal(value(output, "property.unit"), "205");
  assert.equal(value(output, "property.landArea"), "10.957,49");
  assert.equal(value(output, "property.privateArea"), "48,95");
  assert.equal(value(output, "property.totalArea"), "83,058800");
  assert.equal(value(output, "financial.financing"), "259.101,50");
  assert.equal(value(output, "seller.phone"), null);
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

function field(output: ReturnType<typeof extractDeterministicFields>, fieldId: string) {
  return output.fields.find((item) => item.fieldId === fieldId);
}
