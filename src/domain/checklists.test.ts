import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "./checklists";

test("mantém os itens comparáveis e controles documentais dos checklists oficiais como fonte do motor", () => {
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

  assert.ok(minuta.some((field) => field.id === "clause.iptuExemption" && field.itemType === "CLAUSE_PRESENCE"));
  assert.ok(minuta.some((field) => field.id === "certificate.sellerFederal" && field.itemType === "VALIDITY_CHECK"));
  assert.ok(minuta.some((field) => field.id === "signature.manager" && field.itemType === "CLAUSE_PRESENCE"));
  assert.ok(itbi.every((field) => field.itemType === "COMPARISON"));
});
