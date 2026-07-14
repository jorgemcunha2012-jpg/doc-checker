import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import type { ExtractedFieldValue, ProviderExtractionOutput } from "@/domain/validation";
import { buildExtractionQuality, missingCriticalFields, validateCriticalEvidence } from "./extraction-quality-service";

test("identifica campo crítico ausente e registra recuperação", () => {
  const checklist = getChecklist("RECONCILIATION");
  const output: ProviderExtractionOutput = {
    fields: [
      extracted("buyer.name", "Maria"),
      extracted("buyer.cpf", "12345678900"),
      extracted("property.development", "Condomínio"),
      extracted("property.unit", "101"),
      extracted("property.tower", "1"),
      extracted("financial.totalValue", "200000"),
    ],
  };

  const missing = missingCriticalFields("MINUTA", output, checklist);
  assert.ok(missing.some((field) => field.id === "financial.financing"));
  assert.ok(missing.some((field) => field.id === "buyer.rg"));
  assert.ok(missing.some((field) => field.id === "financial.subsidy"));

  const values: ExtractedFieldValue[] = [
    ...output.fields.map((field) => ({ ...field, source: "MINUTA" as const })),
    { ...extracted("financial.financing", "150000"), source: "MINUTA" },
  ];
  const quality = buildExtractionQuality("MINUTA", values, checklist, ["financial.financing"], [], [], false);

  assert.equal(quality.status, "PARTIAL");
  assert.ok(quality.coverage < 100);
  assert.deepEqual(quality.recoveredFields, ["financial.financing"]);
});

test("marca cobertura parcial sem derrubar a conferência", () => {
  const checklist = getChecklist("RECONCILIATION");
  const quality = buildExtractionQuality(
    "MINUTA",
    [{ ...extracted("buyer.name", "Maria"), source: "MINUTA" }],
    checklist,
    [],
    [],
    [],
    false,
  );

  assert.equal(quality.status, "PARTIAL");
  assert.ok(quality.coverage > 0 && quality.coverage < 100);
  assert.ok(quality.missingCriticalFields.includes("financial.financing"));
});

test("sinaliza baixa confiança e conflito interno em campo crítico", () => {
  const checklist = getChecklist("RECONCILIATION");
  const quality = buildExtractionQuality(
    "MINUTA",
    [
      { ...extracted("buyer.name", "Maria"), source: "MINUTA" },
      { ...extracted("buyer.cpf", "12345678900", 55), source: "MINUTA" },
      { ...extracted("property.development", "Condomínio"), source: "MINUTA" },
      { ...extracted("property.unit", "101"), source: "MINUTA" },
      { ...extracted("property.tower", "1"), source: "MINUTA" },
      { ...extracted("financial.financing", "150000"), source: "MINUTA" },
      { ...extracted("financial.totalValue", "200000"), source: "MINUTA" },
    ],
    checklist,
    [],
    ["financial.financing"],
    ["buyer.cpf"],
    false,
  );

  assert.equal(quality.status, "PARTIAL");
  assert.deepEqual(quality.lowConfidenceCriticalFields, ["buyer.cpf"]);
  assert.deepEqual(quality.ambiguousCriticalFields, ["buyer.cpf"]);
  assert.deepEqual(quality.deterministicFields, ["financial.financing"]);
});

test("bloqueia valor financeiro que não aparece na evidência", () => {
  const checklist = getChecklist("RECONCILIATION");
  const validated = validateCriticalEvidence("MINUTA", {
    fields: [{
      fieldId: "financial.subsidy",
      value: "R$ 25,00",
      confidence: 100,
      sourceLocation: { page: 2, rawText: "B.4. 5 - Valor do desconto: R$ 12.495,00" },
    }],
  }, checklist);

  assert.equal(validated.output.fields[0].value, null);
  assert.deepEqual(validated.evidenceIssues, ["financial.subsidy"]);
});

test("aceita CPF quando o valor está mascarado no trecho de evidência", () => {
  const checklist = getChecklist("RECONCILIATION");
  const validated = validateCriticalEvidence("MINUTA", {
    fields: [{
      fieldId: "buyer.cpf",
      value: "61942276303",
      confidence: 96,
      sourceLocation: { page: 2, rawText: "CPF: 619.422.763-03" },
    }],
  }, checklist);

  assert.equal(validated.output.fields[0].value, "61942276303");
  assert.deepEqual(validated.evidenceIssues, []);
});

function extracted(fieldId: string, value: string, confidence = 95) {
  return { fieldId, value, confidence };
}
