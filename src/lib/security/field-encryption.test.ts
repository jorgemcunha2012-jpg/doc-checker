import assert from "node:assert/strict";
import test from "node:test";
import { decryptStoredJson, encryptStoredJson } from "./field-encryption";

const TEST_KEY = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";

test("protege dados estruturados sem manter o conteúdo em claro", () => {
  const previous = process.env.CONFERIA_FIELD_ENCRYPTION_KEY;
  process.env.CONFERIA_FIELD_ENCRYPTION_KEY = TEST_KEY;
  const original = { nome: "Maria da Silva", cpf: "123.456.789-00", valores: [189600, 0] };

  try {
    const encrypted = encryptStoredJson(original);
    const serialized = JSON.stringify(encrypted);
    assert.notEqual(encrypted, original);
    assert.equal(serialized.includes(original.nome), false);
    assert.equal(serialized.includes(original.cpf), false);
    assert.deepEqual(decryptStoredJson<typeof original>(encrypted), original);
  } finally {
    if (previous === undefined) delete process.env.CONFERIA_FIELD_ENCRYPTION_KEY;
    else process.env.CONFERIA_FIELD_ENCRYPTION_KEY = previous;
  }
});

test("mantém dados legados legíveis enquanto a chave ainda não foi configurada", () => {
  const previous = process.env.CONFERIA_FIELD_ENCRYPTION_KEY;
  delete process.env.CONFERIA_FIELD_ENCRYPTION_KEY;
  const original = { campo: "valor legado" };

  try {
    assert.deepEqual(encryptStoredJson(original), original);
    assert.deepEqual(decryptStoredJson(original), original);
  } finally {
    if (previous === undefined) delete process.env.CONFERIA_FIELD_ENCRYPTION_KEY;
    else process.env.CONFERIA_FIELD_ENCRYPTION_KEY = previous;
  }
});
