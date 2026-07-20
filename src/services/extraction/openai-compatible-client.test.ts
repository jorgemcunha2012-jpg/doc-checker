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

test("interrompe uma resposta de provider que não conclui", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

  try {
    const client = new OpenAICompatibleClient({
      apiKey: "test",
      baseUrl: "https://provider.test",
      model: "model",
      providerName: "Provider",
    });
    await assert.rejects(
      () => client.completeJson([{ role: "user", content: "x" }], { timeoutMs: 10 }),
      /Provider excedeu o tempo limite de 0 segundos/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
