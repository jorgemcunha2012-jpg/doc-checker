import assert from "node:assert/strict";
import test from "node:test";
import { requestRateLimitKey } from "./rate-limit-key";

test("forma chave de limite por namespace e IP de origem", () => {
  const request = new Request("https://conferia.test/login", { headers: { "x-forwarded-for": "203.0.113.8, 198.51.100.1" } });
  assert.equal(requestRateLimitKey(request, "login"), "login:203.0.113.8");
});
