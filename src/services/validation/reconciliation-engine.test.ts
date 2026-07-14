import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentSource, ExtractedFieldValue, ExtractionQualityReport } from "@/domain/validation";
import { ReconciliationEngine, type ReconciliationInput } from "./reconciliation-engine";

const engine = new ReconciliationEngine();

test("marca MATCH quando três fontes possuem CPF equivalente após normalização", () => {
  const result = run([
    value("buyer.cpf", "SIOPI", "123.456.789-00"),
    value("buyer.cpf", "MINUTA", "12345678900"),
    value("buyer.cpf", "ITBI", "123 456 789 00"),
  ]);

  assert.equal(field(result, "buyer.cpf").status, "MATCH");
  assert.match(field(result, "buyer.cpf").observation, /normalização/);
});

test("identifica a única fonte divergente", () => {
  const result = run([
    value("buyer.cpf", "SIOPI", "12345678900"),
    value("buyer.cpf", "MINUTA", "12345678900"),
    value("buyer.cpf", "ITBI", "12345679800"),
  ]);

  assert.equal(field(result, "buyer.cpf").status, "DIVERGENCE");
  assert.match(field(result, "buyer.cpf").observation, /apenas na fonte ITBI/);
});

test("não aceita campo crítico quando a evidência não contém o valor extraído", () => {
  const result = run(
    [value("financial.subsidy", "MINUTA", "R$ 25,00")],
    ["MINUTA", "ITBI"],
    {},
    [],
    {},
    { MINUTA: { evidenceIssues: ["financial.subsidy"] } as ExtractionQualityReport },
  );

  assert.equal(field(result, "financial.subsidy").status, "REVIEW_REQUIRED");
  assert.match(field(result, "financial.subsidy").observation, /Evidência insuficiente/);
});

test("encaminha ausência e baixa confiança para revisão", () => {
  const missing = run([value("buyer.cpf", "SIOPI", "12345678900")], ["SIOPI", "MINUTA"]);
  assert.equal(field(missing, "buyer.cpf").status, "REVIEW_REQUIRED");
  assert.match(field(missing, "buyer.cpf").observation, /apenas na fonte Espelho SIOPI/);

  const lowConfidence = run([
    value("buyer.cpf", "SIOPI", "12345678900", 65),
    value("buyer.cpf", "MINUTA", "12345678900"),
  ], ["SIOPI", "MINUTA"]);
  assert.equal(field(lowConfidence, "buyer.cpf").status, "REVIEW_REQUIRED");
  assert.match(field(lowConfidence, "buyer.cpf").observation, /SIOPI/);
});

test("trata pequena diferença textual e conflito interno como revisão", () => {
  const typo = run([
    value("buyer.name", "SIOPI", "José da Silva"),
    value("buyer.name", "MINUTA", "José da Silvaa"),
  ], ["SIOPI", "MINUTA"]);
  assert.equal(field(typo, "buyer.name").status, "REVIEW_REQUIRED");
  assert.match(field(typo, "buyer.name").observation, /pequena diferença textual/);

  const conflict = run(
    [value("buyer.cpf", "SIOPI", "12345678900"), value("buyer.cpf", "MINUTA", "12345678900")],
    ["SIOPI", "MINUTA"],
    { SIOPI: ["buyer.cpf"] },
  );
  assert.equal(field(conflict, "buyer.cpf").status, "REVIEW_REQUIRED");
  assert.match(field(conflict, "buyer.cpf").observation, /conflitantes/);
});

test("mantém processo utilizável quando uma fonte está ilegível e preserva evidência", () => {
  const result = run(
    [
      value("buyer.cpf", "SIOPI", "12345678900"),
      {
        ...value("buyer.cpf", "MINUTA", null, 0),
        sourceLocation: { page: 2, section: "Comprador", rawText: "CPF do comprador" },
      },
    ],
    ["SIOPI", "MINUTA"],
    {},
    ["MINUTA"],
  );

  const cpf = field(result, "buyer.cpf");
  assert.equal(cpf.status, "SOURCE_UNREADABLE");
  assert.equal(cpf.valuesBySource.MINUTA?.sourceLocation?.page, 2);
});

test("não oculta campos esperados quando estão ausentes em todas as fontes", () => {
  const result = run([], ["SIOPI", "MINUTA"]);
  const cpf = field(result, "buyer.cpf");

  assert.equal(cpf.status, "REVIEW_REQUIRED");
  assert.match(cpf.observation, /não encontrado/);
});

test("marca fonte ilegível mesmo quando nenhum campo foi extraído dela", () => {
  const result = run([], ["MINUTA"], {}, ["MINUTA"], {
    MINUTA: "PDF escaneado/imagem sem texto legível suficiente após OCR.",
  });
  const cpf = field(result, "buyer.cpf");

  assert.equal(cpf.status, "SOURCE_UNREADABLE");
  assert.match(cpf.observation, /não foi interpretada/);
  assert.match(cpf.observation, /PDF escaneado/);
});

test("compara ITBI com qualquer documento complementar que contenha o mesmo campo", () => {
  const result = run(
    [
      value("buyer.cpf", "ITBI", "123.456.789-00"),
      value("buyer.cpf", "DOCUMENTO_COMPLEMENTAR", "12345678900"),
    ],
    ["ITBI", "DOCUMENTO_COMPLEMENTAR"],
  );

  assert.equal(field(result, "buyer.cpf").status, "MATCH");
});

test("usa cadastro do empreendimento como referência de unidade e normaliza área", () => {
  const result = run(
    [
      value("property.tower", "CADASTRO_EMPREENDIMENTO", "23"),
      value("property.tower", "MINUTA", "Torre 23"),
      value("property.privateArea", "CADASTRO_EMPREENDIMENTO", "45,62 m²"),
      value("property.privateArea", "MINUTA", "45.6200m2"),
    ],
    ["CADASTRO_EMPREENDIMENTO", "MINUTA"],
  );

  assert.equal(field(result, "property.privateArea").status, "MATCH");
  assert.equal(field(result, "property.tower").status, "MATCH");
});

test("trata variações gramaticais seguras de estado civil como equivalentes", () => {
  const result = run(
    [
      value("buyer.maritalStatus", "MINUTA", "solteiro"),
      value("buyer.maritalStatus", "DADOS_RESERVA", "Solteiro(a)"),
    ],
    ["MINUTA", "DADOS_RESERVA"],
  );

  assert.equal(field(result, "buyer.maritalStatus").status, "MATCH");
});

test("trata zero e vazio como equivalentes apenas em campos financeiros opcionais", () => {
  const result = run(
    [value("financial.fgts", "MINUTA", "R$ 0,00")],
    ["MINUTA", "SIOPI"],
  );

  assert.equal(field(result, "financial.fgts").status, "MATCH");
  assert.match(field(result, "financial.fgts").observation, /campo opcional/);
});

test("compara print de pagamento obrigatório contra composição da minuta", () => {
  const result = run(
    [
      value("financial.totalValue", "DADOS_RESERVA", "R$ 237.000,00"),
      value("financial.financing", "DADOS_RESERVA", "R$ 114.616,91"),
      value("financial.totalValue", "MINUTA", "R$ 237.000,00"),
      value("financial.financing", "MINUTA", "R$ 114.616,91"),
      value("financial.fgts", "MINUTA", "R$ 0,00"),
      value("financial.subsidy", "MINUTA", "R$ 51.776,00"),
    ],
    ["DADOS_RESERVA", "MINUTA"],
  );

  assert.equal(field(result, "financial.totalValue").status, "MATCH");
  assert.equal(field(result, "financial.financing").status, "MATCH");
  assert.equal(result.results.some((item) => item.field.id === "financial.fgts"), false);
  assert.equal(result.results.some((item) => item.field.id === "financial.subsidy"), false);
});

test("compara FGTS do print apenas quando presente", () => {
  const result = run(
    [
      value("financial.totalValue", "DADOS_RESERVA", "R$ 237.000,00"),
      value("financial.financing", "DADOS_RESERVA", "R$ 114.616,91"),
      value("financial.fgts", "DADOS_RESERVA", "R$ 12.000,00"),
      value("financial.totalValue", "MINUTA", "R$ 237.000,00"),
      value("financial.financing", "MINUTA", "R$ 114.616,91"),
      value("financial.fgts", "MINUTA", "R$ 12.000,00"),
    ],
    ["DADOS_RESERVA", "MINUTA"],
  );

  assert.equal(field(result, "financial.totalValue").status, "MATCH");
  assert.equal(field(result, "financial.financing").status, "MATCH");
  assert.equal(field(result, "financial.fgts").status, "MATCH");
});

test("compara subsídio do print apenas quando presente", () => {
  const result = run(
    [
      value("financial.totalValue", "DADOS_RESERVA", "R$ 237.000,00"),
      value("financial.financing", "DADOS_RESERVA", "R$ 114.616,91"),
      value("financial.subsidy", "DADOS_RESERVA", "R$ 51.776,00"),
      value("financial.totalValue", "MINUTA", "R$ 237.000,00"),
      value("financial.financing", "MINUTA", "R$ 114.616,91"),
      value("financial.subsidy", "MINUTA", "R$ 51.776,00"),
    ],
    ["DADOS_RESERVA", "MINUTA"],
  );

  assert.equal(field(result, "financial.totalValue").status, "MATCH");
  assert.equal(field(result, "financial.financing").status, "MATCH");
  assert.equal(field(result, "financial.subsidy").status, "MATCH");
});

test("separa e confere dois compradores pelo identificador de participante", () => {
  const maria = "cpf_11111111111";
  const joao = "cpf_22222222222";
  const result = run(
    [
      value("buyer.name", "SIOPI", "Maria Silva", 95, maria),
      value("buyer.cpf", "SIOPI", "111.111.111-11", 95, maria),
      value("buyer.name", "MINUTA", "Maria Silva", 95, maria),
      value("buyer.cpf", "MINUTA", "11111111111", 95, maria),
      value("buyer.name", "SIOPI", "João Souza", 95, joao),
      value("buyer.cpf", "SIOPI", "222.222.222-22", 95, joao),
      value("buyer.name", "MINUTA", "João Souza", 95, joao),
      value("buyer.cpf", "MINUTA", "22222222222", 95, joao),
    ],
    ["SIOPI", "MINUTA"],
  );

  assert.equal(field(result, `buyer.cpf::${maria}`).status, "MATCH");
  assert.equal(field(result, `buyer.cpf::${joao}`).status, "MATCH");
  assert.match(field(result, `buyer.name::${maria}`).field.label, /Maria Silva/);
  assert.match(field(result, `buyer.name::${joao}`).field.label, /João Souza/);
});

function run(
  values: ExtractedFieldValue[],
  participatingSources: DocumentSource[] = ["SIOPI", "MINUTA", "ITBI"],
  conflictedFieldsBySource: ReconciliationInput["conflictedFieldsBySource"] = {},
  unreadableSources: DocumentSource[] = [],
  sourceErrors: ReconciliationInput["sourceErrors"] = {},
  qualityBySource: ReconciliationInput["qualityBySource"] = {},
) {
  return engine.run("org_test", {
    values,
    participatingSources,
    conflictedFieldsBySource,
    unreadableSources,
    sourceErrors,
    qualityBySource,
    usedPdfVisionFallback: false,
  });
}

function value(
  fieldId: string,
  source: DocumentSource,
  fieldValue: string | null,
  confidence = 95,
  participantId?: string,
): ExtractedFieldValue {
  return {
    fieldId,
    source,
    value: fieldValue,
    confidence,
    participantId,
    sourceLocation: fieldValue ? { page: 1, rawText: fieldValue } : undefined,
  };
}

function field(run: ReturnType<typeof engine.run>, fieldId: string) {
  const found = run.results.find((result) => result.field.id === fieldId);
  assert.ok(found, `Campo ${fieldId} deveria estar presente`);
  return found;
}
