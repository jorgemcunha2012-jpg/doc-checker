import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLogin } from "./login-identity";

test("aceita somente email completo no login", () => {
  assert.equal(normalizeLogin(" Admin@Empresa.com "), "admin@empresa.com");
  assert.equal(normalizeLogin("jorge"), "");
  assert.equal(normalizeLogin(null), "");
});
