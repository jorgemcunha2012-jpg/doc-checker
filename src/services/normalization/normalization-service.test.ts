import assert from "node:assert/strict";
import test from "node:test";
import { normalizeValue } from "./normalization-service";

test("normaliza valores monetários brasileiros e decimais para o mesmo valor", () => {
  const expected = "388000.00";

  assert.equal(normalizeValue("R$ 388.000,00", "valor_monetario"), expected);
  assert.equal(normalizeValue("388000.00", "valor_monetario"), expected);
  assert.equal(normalizeValue("388.000", "valor_monetario"), expected);
  assert.equal(normalizeValue("R$ 388000,00", "valor_monetario"), expected);
});

test("reconhece o último separador como decimal quando há ponto e vírgula", () => {
  assert.equal(normalizeValue("1.234,56", "valor_monetario"), "1234.56");
  assert.equal(normalizeValue("1,234.56", "valor_monetario"), "1234.56");
});
