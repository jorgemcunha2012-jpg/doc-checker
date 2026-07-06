import assert from "node:assert/strict";
import test from "node:test";
import type { FieldComparisonResult } from "@/domain/validation";
import { getChecklist } from "@/domain/checklists";
import { buildApprovedEquivalenceRule, normalizeFieldValue } from "./supervised-learning-service";

const checklist = getChecklist("RECONCILIATION");

test("normaliza estado civil com variação gramatical", () => {
  const field = checklist.find((item) => item.id === "buyer.maritalStatus");
  assert.ok(field);

  assert.equal(normalizeFieldValue("Solteiro(a)", field), normalizeFieldValue("solteiro", field));
  assert.equal(normalizeFieldValue("CASADA", field), normalizeFieldValue("casado", field));
});

test("gera regra aprendida para alias textual seguro aprovado", () => {
  const field = checklist.find((item) => item.id === "property.development");
  assert.ok(field);
  const rule = buildApprovedEquivalenceRule({
    organizationId: "org",
    field,
    status: "DIVERGENCE",
    observation: "aprovado manualmente",
    valuesBySource: {
      MINUTA: { value: "VISTA COSTEIRA CONDOMINIO CLUBE CUMBUCO", normalizedValue: "VISTA COSTEIRA CONDOMINIO CLUBE CUMBUCO", confidence: 95 },
      DADOS_RESERVA: { value: "VISTA COSTEIRA CUMBUCO", normalizedValue: "VISTA COSTEIRA CUMBUCO", confidence: 95 },
    },
  } satisfies FieldComparisonResult);

  assert.equal(rule?.ruleKind, "TEXT_ALIAS");
  assert.match(rule?.signature ?? "", /VISTA COSTEIRA/);
});

test("não aprende divergência monetária real como equivalência", () => {
  const field = checklist.find((item) => item.id === "financial.downPayment");
  assert.ok(field);
  const rule = buildApprovedEquivalenceRule({
    organizationId: "org",
    field,
    status: "DIVERGENCE",
    observation: "aprovado manualmente",
    valuesBySource: {
      MINUTA: { value: "R$ 25.400,00", normalizedValue: "25400.00", confidence: 95 },
      DADOS_RESERVA: { value: "R$ 20.000,00", normalizedValue: "20000.00", confidence: 95 },
    },
  } satisfies FieldComparisonResult);

  assert.equal(rule, null);
});
