import assert from "node:assert/strict";
import test from "node:test";
import { documentRetentionCutoff } from "./document-retention-policy";

test("calcula retenção de documentos em 40 dias completos", () => {
  assert.equal(
    documentRetentionCutoff(new Date("2026-07-29T12:00:00.000Z")),
    "2026-06-19T12:00:00.000Z",
  );
});
