import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentSource, ExtractedFieldValue } from "@/domain/validation";
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
  assert.equal(cpf.status, "REVIEW_REQUIRED");
  assert.equal(cpf.valuesBySource.MINUTA?.sourceLocation?.page, 2);
});

test("não oculta campos esperados quando estão ausentes em todas as fontes", () => {
  const result = run([], ["SIOPI", "MINUTA"]);
  const cpf = field(result, "buyer.cpf");

  assert.equal(cpf.status, "REVIEW_REQUIRED");
  assert.match(cpf.observation, /não encontrado/);
});

test("marca fonte ilegível mesmo quando nenhum campo foi extraído dela", () => {
  const result = run([], ["MINUTA"], {}, ["MINUTA"]);
  const cpf = field(result, "buyer.cpf");

  assert.equal(cpf.status, "SOURCE_UNREADABLE");
  assert.match(cpf.observation, /não foi interpretada/);
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

function run(
  values: ExtractedFieldValue[],
  participatingSources: DocumentSource[] = ["SIOPI", "MINUTA", "ITBI"],
  conflictedFieldsBySource: ReconciliationInput["conflictedFieldsBySource"] = {},
  unreadableSources: DocumentSource[] = [],
) {
  return engine.run("org_test", {
    values,
    participatingSources,
    conflictedFieldsBySource,
    unreadableSources,
    sourceErrors: {},
    usedPdfVisionFallback: false,
  });
}

function value(
  fieldId: string,
  source: DocumentSource,
  fieldValue: string | null,
  confidence = 95,
): ExtractedFieldValue {
  return {
    fieldId,
    source,
    value: fieldValue,
    confidence,
    sourceLocation: fieldValue ? { page: 1, rawText: fieldValue } : undefined,
  };
}

function field(run: ReturnType<typeof engine.run>, fieldId: string) {
  const found = run.results.find((result) => result.field.id === fieldId);
  assert.ok(found, `Campo ${fieldId} deveria estar presente`);
  return found;
}
