import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import { DocumentExtractionService } from "./document-extraction-service";

test("preserva a extração determinística do DTI quando o provider demora ou falha", async () => {
  const service = new DocumentExtractionService(
    {} as never,
    { structureText: async () => { throw new Error("timeout"); } } as never,
  );

  const result = await (service as unknown as {
    extractTextWithRecovery: (text: string, checklist: ReturnType<typeof getChecklist>, source: "ITBI") => Promise<{ output: { fields: Array<{ fieldId: string; value: string | null }> } }>;
  }).extractTextWithRecovery(
    [
      "Nome: JOAO ERIC ANTONIO BEZERRA OLIVEIRA",
      "CPFCNPJ: 028.349.913-32",
      "Text1: SPE CAUCAIA CT EMPREENDIMENTOS IMOBILIARIOS LTDA",
      "Text2: 53.635.373/0001-03",
      "Inscrição do IPTU: 147158-9",
      "Text3: RUA TABUZIOS, TABUBA, CAUCAIA/CE",
      "Text4: 69465",
      "Área do terreno m²: 10.006,00",
      "Área privativa m²: 48,19m²",
      "Área comum m²: 41,524337m²",
      "Área total m²: 89,714337m²",
      "Complemento: T3, AP 201",
      "Valor Financiado: 360.000,00",
      "Valor Não Financiado: 55.000,00",
      "Valor Total Declarado: 415.000,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "ITBI",
  );

  assert.equal(result.output.fields.find((field) => field.fieldId === "property.landArea")?.value, "10.006,00");
  assert.equal(result.output.fields.find((field) => field.fieldId === "property.registration")?.value, "69465");
  assert.equal(result.output.fields.find((field) => field.fieldId === "financial.financing")?.value, "360.000,00");
});

test("revisa todos os dados pessoais visíveis da tela de Reserva antes de aceitar a leitura", async () => {
  const previous = process.env.CONFERIA_SKIP_LOCAL_OCR;
  process.env.CONFERIA_SKIP_LOCAL_OCR = "true";
  let identityCalls = 0;
  let genericCalls = 0;
  const service = new DocumentExtractionService({
    extractReservationFromImage: async () => output([
      extracted("buyer.name", "MARIA SILVA", "NOME DO CLIENTE: MARIA SILVA"),
      extracted("buyer.cpf", "123.456.789-00", "CPF: 123.456.789-00"),
    ]),
    transcribeReservationImage: async () => "NOME DO CLIENTE CPF / CNPJ RG CELULAR ESTADO CIVIL E-MAIL ENDEREÇO",
    extractReservationIdentityFromImage: async () => {
      identityCalls += 1;
      return output([
        extracted("buyer.name", "MARIA SILVA", "NOME DO CLIENTE: MARIA SILVA"),
        extracted("buyer.cpf", "123.456.789-00", "CPF: 123.456.789-00"),
        extracted("buyer.rg", "998877", "RG: 998877"),
        extracted("buyer.maritalStatus", "Solteira", "ESTADO CIVIL: Solteira"),
        extracted("buyer.address", "Rua Um, 10, Centro, Fortaleza, Ceará", "ENDEREÇO: Rua Um, 10, Centro, Fortaleza, Ceará"),
        extracted("buyer.email", "maria@example.com", "E-MAIL: maria@example.com"),
        extracted("buyer.phone", "+5585999999999", "CELULAR: +5585999999999"),
      ]);
    },
    extractReservationUnitFromImage: async () => output([]),
    extractReservationFinancialComponentsFromImage: async () => output([]),
    extractFromImage: async () => { genericCalls += 1; return output([]); },
  } as never, {} as never);

  try {
    const result = await extractReservationVisual(service);
    assert.equal(identityCalls, 1);
    assert.equal(genericCalls, 0);
    assert.equal(value(result, "buyer.address"), "Rua Um, 10, Centro, Fortaleza, Ceará");
    assert.equal(value(result, "buyer.phone"), "+5585999999999");
  } finally {
    if (previous === undefined) delete process.env.CONFERIA_SKIP_LOCAL_OCR;
    else process.env.CONFERIA_SKIP_LOCAL_OCR = previous;
  }
});

test("revisa valor total e financiamento da tela financeira de Reserva antes de comparar", async () => {
  const previous = process.env.CONFERIA_SKIP_LOCAL_OCR;
  process.env.CONFERIA_SKIP_LOCAL_OCR = "true";
  let financialCalls = 0;
  let genericCalls = 0;
  const service = new DocumentExtractionService({
    extractReservationFromImage: async () => output([]),
    transcribeReservationImage: async () => "CONDIÇÃO DE PAGAMENTO VALOR DO CONTRATO FINANCIAMENTO",
    extractReservationIdentityFromImage: async () => output([]),
    extractReservationUnitFromImage: async () => output([]),
    extractReservationFinancialComponentsFromImage: async () => {
      financialCalls += 1;
      return output([
        extracted("financial.totalValue", "R$ 220.000,00", "Valor do contrato: R$ 220.000,00"),
        extracted("financial.financing", "R$ 170.000,00", "Financiamento: R$ 170.000,00"),
      ]);
    },
    extractFromImage: async () => { genericCalls += 1; return output([]); },
  } as never, {} as never);

  try {
    const result = await extractReservationVisual(service);
    assert.equal(financialCalls, 1);
    assert.equal(genericCalls, 0);
    assert.equal(value(result, "financial.totalValue"), "R$ 220.000,00");
    assert.equal(value(result, "financial.financing"), "R$ 170.000,00");
  } finally {
    if (previous === undefined) delete process.env.CONFERIA_SKIP_LOCAL_OCR;
    else process.env.CONFERIA_SKIP_LOCAL_OCR = previous;
  }
});

test("não repete a leitura financeira quando a extração focada já tem evidências confiáveis", async () => {
  const previous = process.env.CONFERIA_SKIP_LOCAL_OCR;
  process.env.CONFERIA_SKIP_LOCAL_OCR = "true";
  let financialCalls = 0;
  const service = new DocumentExtractionService({
    extractReservationFromImage: async () => output([
      extracted("financial.totalValue", "R$ 220.000,00", "Valor do contrato: R$ 220.000,00"),
      extracted("financial.financing", "R$ 170.000,00", "Financiamento: R$ 170.000,00"),
    ]),
    transcribeReservationImage: async () => "CONDIÇÃO DE PAGAMENTO VALOR DO CONTRATO FINANCIAMENTO",
    extractReservationIdentityFromImage: async () => output([]),
    extractReservationUnitFromImage: async () => output([]),
    extractReservationFinancialComponentsFromImage: async () => { financialCalls += 1; return output([]); },
    extractFromImage: async () => output([]),
  } as never, {} as never);

  try {
    const result = await extractReservationVisual(service);
    assert.equal(financialCalls, 0);
    assert.equal(value(result, "financial.financing"), "R$ 170.000,00");
  } finally {
    if (previous === undefined) delete process.env.CONFERIA_SKIP_LOCAL_OCR;
    else process.env.CONFERIA_SKIP_LOCAL_OCR = previous;
  }
});

function extractReservationVisual(service: DocumentExtractionService) {
  return (service as unknown as {
    extractSingleVisualDocument: (document: never, checklist: ReturnType<typeof getChecklist>, source: "DADOS_RESERVA") => Promise<{ fields: Array<{ fieldId: string; value: string | null }> }>;
  }).extractSingleVisualDocument({
    id: "image",
    organizationId: "organization",
    name: "reserva.png",
    type: "IMAGE",
    source: "DADOS_RESERVA",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  } as never, getChecklist("RECONCILIATION"), "DADOS_RESERVA");
}

function output(fields: Array<{ fieldId: string; value: string; confidence: number; sourceLocation: { rawText: string; section: string } }>) {
  return { fields };
}

function extracted(fieldId: string, value: string, rawText: string) {
  return { fieldId, value, confidence: 98, sourceLocation: { section: "Dados da reserva", rawText } };
}

function value(output: { fields: Array<{ fieldId: string; value: string | null }> }, fieldId: string) {
  return output.fields.find((field) => field.fieldId === fieldId)?.value;
}
