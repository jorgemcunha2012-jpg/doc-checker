import assert from "node:assert/strict";
import test from "node:test";
import { consumeRateLimit } from "./rate-limit";

test("bloqueia somente depois do limite e libera após a janela", () => {
  assert.equal(consumeRateLimit("test-rate-limit", 2, 1000, 0).allowed, true);
  assert.equal(consumeRateLimit("test-rate-limit", 2, 1000, 1).allowed, true);
  assert.equal(consumeRateLimit("test-rate-limit", 2, 1000, 2).allowed, false);
  assert.equal(consumeRateLimit("test-rate-limit", 2, 1000, 1000).allowed, true);
});
