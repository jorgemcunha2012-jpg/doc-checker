import assert from "node:assert/strict";
import test from "node:test";
import { humanFieldLabel } from "./field-labels";

test("uses accessible Portuguese labels for internal field IDs", () => {
  assert.equal(humanFieldLabel("buyer.name"), "Nome do comprador");
  assert.equal(humanFieldLabel("buyer.address"), "Endereço do comprador");
  assert.equal(humanFieldLabel("financial.subsidy"), "Subsídio");
});

test("supports repeated participant IDs and unknown fallback", () => {
  assert.equal(humanFieldLabel("buyer.name::buyer_2"), "Nome do comprador");
  assert.equal(humanFieldLabel("field.unknown"), "field.unknown");
});

