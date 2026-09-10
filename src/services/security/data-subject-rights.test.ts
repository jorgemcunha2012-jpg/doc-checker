import assert from "node:assert/strict";
import test from "node:test";
import { dataSubjectRequestFingerprint, normalizeCpf } from "./data-subject-identifier";

test("normaliza CPF para solicitação do titular", () => {
  assert.equal(normalizeCpf("123.456.789-00"), "12345678900");
  assert.throws(() => normalizeCpf("123"), /CPF válido/);
});

test("auditoria da solicitação não guarda CPF em claro", () => {
  const fingerprint = dataSubjectRequestFingerprint("123.456.789-00");
  assert.equal(fingerprint.includes("12345678900"), false);
  assert.equal(fingerprint.length, 64);
});
