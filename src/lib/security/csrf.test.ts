import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedMutationOrigin } from "./csrf";

test("aceita somente a origem exata em mutações", () => {
  assert.equal(isAllowedMutationOrigin("https://conferia.test", "https://conferia.test"), true);
  assert.equal(isAllowedMutationOrigin(null, "https://conferia.test"), false);
  assert.equal(isAllowedMutationOrigin("https://evil.test", "https://conferia.test"), false);
});
