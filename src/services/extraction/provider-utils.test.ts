import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import { checklistPrompt, coerceExtractionOutput } from "./provider-utils";

test("distingue semanticamente endereços das partes e do imóvel no prompt", () => {
  const prompt = checklistPrompt(getChecklist("RECONCILIATION"));

  assert.match(prompt, /buyer\.address: Endereço residencial/);
  assert.match(prompt, /buyer\.address:.*nunca usar endereço do imóvel/);
  assert.match(prompt, /property\.address: Endereço do imóvel/);
  assert.match(prompt, /property\.address:.*nunca usar domicílio do comprador/);
});

test("preserva múltiplos compradores retornados pelo provider", () => {
  const checklist = getChecklist("RECONCILIATION");
  const output = coerceExtractionOutput({
    fields: [
      { fieldId: "buyer.name", participantId: "buyer_1", value: "Maria", confidence: 95 },
      { fieldId: "buyer.name", participantId: "buyer_2", value: "João", confidence: 94 },
    ],
  }, checklist);
  const names = output.fields.filter((field) => field.fieldId === "buyer.name" && field.value);

  assert.equal(names.length, 2);
  assert.deepEqual(names.map((field) => field.participantId), ["buyer_1", "buyer_2"]);
});
