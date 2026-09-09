import assert from "node:assert/strict";
import test from "node:test";
import { assertAllowedProviderUrl } from "./provider-gateway";

test("gateway aceita somente endpoint HTTPS sem credenciais embutidas", () => {
  assert.equal(assertAllowedProviderUrl("https://api.anthropic.com/v1", "Haiku").protocol, "https:");
  assert.throws(() => assertAllowedProviderUrl("http://api.example.test/v1", "Provider"), /HTTPS/);
  assert.throws(() => assertAllowedProviderUrl("https://user:secret@api.example.test/v1", "Provider"), /credenciais/);
  assert.throws(() => assertAllowedProviderUrl("https://api.example.test/v1", "Haiku"), /não autorizado/);
});
