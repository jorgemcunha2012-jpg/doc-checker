import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import { checklistPrompt } from "./provider-utils";

test("distingue semanticamente endereços das partes e do imóvel no prompt", () => {
  const prompt = checklistPrompt(getChecklist("RECONCILIATION"));

  assert.match(prompt, /buyer\.address: Endereço residencial/);
  assert.match(prompt, /buyer\.address:.*nunca usar endereço do imóvel/);
  assert.match(prompt, /property\.address: Endereço do imóvel/);
  assert.match(prompt, /property\.address:.*nunca usar domicílio do comprador/);
});
