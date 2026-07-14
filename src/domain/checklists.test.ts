import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "./checklists";

test("mantém os itens comparáveis dos checklists oficiais como fonte do motor", () => {
  const minuta = getChecklist("RECONCILIATION");
  const itbi = getChecklist("ITBI");
  const ids = new Set(minuta.map((field) => field.id));

  for (const fieldId of [
    "contract.agencyCode",
    "contract.financingModality",
    "buyer.nationality",
    "property.registryOffice",
    "property.iptu",
    "financial.appraisalValue",
  ]) assert.ok(ids.has(fieldId), `Checklist oficial de Minuta deve conter ${fieldId}`);

  for (const fieldId of [
    "seller.email",
    "seller.phone",
    "transaction.instrumentDate",
    "transaction.nature",
    "property.iptu",
    "property.type",
  ]) assert.ok(itbi.some((field) => field.id === fieldId), `Checklist oficial de ITBI deve conter ${fieldId}`);

  assert.ok(minuta.every((field) => field.itemType === "COMPARISON"));
  assert.ok(itbi.every((field) => field.itemType === "COMPARISON"));
});
