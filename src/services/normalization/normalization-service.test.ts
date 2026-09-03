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

test("equivale matrícula mascarada e áreas apresentadas com precisões diferentes", () => {
  assert.equal(normalizeValue("113.632", "identificador_imovel"), normalizeValue("113632", "identificador_imovel"));
  assert.equal(normalizeValue("37,352316 m²", "area"), normalizeValue("37,35 m²", "area"));
});

test("normaliza complementos acessórios de endereço sem perder logradouro e número", () => {
  const minuta = normalizeValue("RUA BENVINDA Nº 130, COMPL. PARTE GLEBA-M PASSARÉ, FORTALEZA-CE", "endereco");
  const siopi = normalizeValue("RUA BENVINDA, nº 130, BL. T2, AP1504, PASSARÉ, CEP 60.861-340, FORTALEZA/CE", "endereco");
  assert.equal(minuta, siopi);
});
