import assert from "node:assert/strict";
import test from "node:test";
import { restoreTokenizedOutput, tokenizeSensitiveText } from "./pii-tokenizer";

test("remove identificadores pessoais do texto e restaura a resposta estruturada", () => {
  const input = "Cliente: Maria da Silva\nCPF: 080.061.353-80\nE-mail: maria@example.com\nTelefone: (85) 99999-1234";
  const tokenized = tokenizeSensitiveText(input);
  assert.doesNotMatch(tokenized.text, /080\.061\.353-80|maria@example\.com|99999-1234|Maria da Silva/);
  assert.match(tokenized.text, /\[CPF_01\]/);
  const restored = restoreTokenizedOutput({ fields: [{ fieldId: "buyer.cpf", value: "[CPF_01]", confidence: 100, sourceLocation: { rawText: "CPF: [CPF_01]" } }] }, tokenized.replacements);
  assert.equal(restored.fields[0].value, "080.061.353-80");
  assert.equal(restored.fields[0].sourceLocation?.rawText, "CPF: 080.061.353-80");
});
