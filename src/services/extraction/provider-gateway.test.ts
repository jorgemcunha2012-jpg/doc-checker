import assert from "node:assert/strict";
import test from "node:test";
import { DeepSeekProvider } from "./deepseek-provider";
import { KimiProvider } from "./kimi-provider";
import { assertAllowedProviderUrl } from "./provider-gateway";

test("gateway aceita somente endpoint HTTPS sem credenciais embutidas", () => {
  assert.equal(assertAllowedProviderUrl("https://api.anthropic.com/v1", "Haiku").protocol, "https:");
  assert.throws(() => assertAllowedProviderUrl("http://api.example.test/v1", "Provider"), /HTTPS/);
  assert.throws(() => assertAllowedProviderUrl("https://user:secret@api.example.test/v1", "Provider"), /credenciais/);
  assert.throws(() => assertAllowedProviderUrl("https://api.example.test/v1", "Haiku"), /não autorizado/);
});

test("gateway permite somente o host configurado do Azure OpenAI", () => {
  const previous = process.env.AZURE_OPENAI_ENDPOINT;
  process.env.AZURE_OPENAI_ENDPOINT = "https://conferia.openai.azure.com";
  try {
    assert.equal(
      assertAllowedProviderUrl("https://conferia.openai.azure.com/openai/deployments/vision", "Azure OpenAI").hostname,
      "conferia.openai.azure.com",
    );
    assert.throws(
      () => assertAllowedProviderUrl("https://outro.openai.azure.com/openai/deployments/vision", "Azure OpenAI"),
      /não autorizado/,
    );
  } finally {
    if (previous === undefined) delete process.env.AZURE_OPENAI_ENDPOINT;
    else process.env.AZURE_OPENAI_ENDPOINT = previous;
  }
});

test("gateway bloqueia os hosts legados de Kimi e DeepSeek", () => {
  assert.throws(() => assertAllowedProviderUrl("https://api.moonshot.ai/v1", "Kimi"), /não autorizado/);
  assert.throws(() => assertAllowedProviderUrl("https://api.deepseek.com/v1", "DeepSeek"), /não autorizado/);
});

test("provedores legados não podem ser instanciados", () => {
  assert.throws(() => new KimiProvider(), /não é um provedor aprovado/);
  assert.throws(() => new DeepSeekProvider(), /não é um provedor aprovado/);
});
