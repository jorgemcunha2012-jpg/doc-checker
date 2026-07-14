import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import { extractDeterministicFields } from "./deterministic-field-extractor";

test("extrai o número do contrato quando a minuta o apresenta como número do processo em ressalvas", () => {
  const output = extractDeterministicFields(
    "Ressalvas\nNúmero do processo: 12345-AB/2026\nDemais condições",
    getChecklist("MINUTA"),
    "MINUTA",
  );

  const field = output.fields.find((item) => item.fieldId === "contract.number");
  assert.equal(field?.value, "12345-AB/2026");
  assert.equal(field?.sourceLocation?.section, "Ressalvas / identificação do processo");
});
