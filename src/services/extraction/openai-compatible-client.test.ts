import assert from "node:assert/strict";
import test from "node:test";
import { OpenAICompatibleClient } from "./openai-compatible-client";

test("aproveita campos quando o provider retorna JSON de fields truncado", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content:
          "{\"fields\":[{\"fieldId\":\"buyer.name\",\"participantId\":\"1\",\"value\":\"NYASHI DE OLIVEIRA NUNES\",\"confidence\":0.99",
      },
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const client = new OpenAICompatibleClient({
      apiKey: "test",
      baseUrl: "https://provider.test",
      model: "model",
      providerName: "Provider",
    });
    const result = await client.completeJson([{ role: "user", content: "x" }]) as {
      fields: Array<{ fieldId: string; value: string; confidence: number }>;
    };

    assert.deepEqual(result.fields, [{
      fieldId: "buyer.name",
      value: "NYASHI DE OLIVEIRA NUNES",
      confidence: 0.99,
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
