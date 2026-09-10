import assert from "node:assert/strict";
import test from "node:test";
import { JsonBodyError, readJsonBody, userActionSchema } from "./json-body";

test("rejeita corpo JSON acima do limite", async () => {
  const request = new Request("https://conferia.test", { method: "POST", body: JSON.stringify({ action: "ACTIVATE", padding: "x".repeat(100) }) });
  await assert.rejects(() => readJsonBody(request, userActionSchema, 20), JsonBodyError);
});

test("rejeita campos extras e ações fora da lista", async () => {
  const request = new Request("https://conferia.test", { method: "POST", body: JSON.stringify({ action: "DELETE_ALL" }) });
  await assert.rejects(() => readJsonBody(request, userActionSchema), JsonBodyError);
});
