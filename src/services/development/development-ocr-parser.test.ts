import test from "node:test";
import assert from "node:assert/strict";
import { extractDevelopmentFromOcrText } from "./development-ocr-parser";

test("extrai tipos de unidade de matrícula OCR com torres, apartamentos e fração ideal", () => {
  const result = extractDevelopmentFromOcrText(`
    Matrícula: 6426
    EMPREENDIMENTO RESIDENCIAL MULTIFAMILIAR denominado CONDOMÍNIO VITÓRIA MARACANAÚ,
    situado no Município de Maracanaú-CE.
    TIPO A - 2º, 3º e 4º PAVIMENTOS - Torres 01 a 02, apartamentos de nºs 201, 202, 203 e 204,
    com uma área privativa principal de 38,08m², área de uso comum de 34,576616m²,
    perfazendo uma área total real de 72,656616m² e fração ideal de 0,0022143433;
    TIPO B - 1º PAVIMENTO/TÉRREO - Torres 01, 04 e 12, apartamentos de nºs 101;
    Torres 02, 03 e 11, apartamentos de nºs 104, com uma área privativa principal de 50,43m²,
    área de uso comum de 35,697996m², perfazendo uma área total real de 86,127996m²
    e fração ideal de 0,0022861583.
  `);

  assert.equal(result.name, "Condominio Vitoria Maracanau");
  assert.equal(result.city, "Maracanau");
  assert.equal(result.registration, "6426");
  assert.equal(result.units.length, 2);
  const typeAUnit = result.units.find((unit) => unit.typology === "Tipo A");
  assert.deepEqual(stripEvidence(typeAUnit), {
    tower: "",
    unit: "",
    privateArea: "38,08",
    totalArea: "72,656616",
    idealFraction: "0,0022143433",
    typology: "Tipo A",
    confidence: 88,
  });
  const typeBUnit = result.units.find((unit) => unit.typology === "Tipo B");
  assert.deepEqual(stripEvidence(typeBUnit), {
    tower: "",
    unit: "",
    privateArea: "50,43",
    totalArea: "86,127996",
    idealFraction: "0,0022861583",
    typology: "Tipo B",
    confidence: 88,
  });
});

function stripEvidence<T extends { evidence?: unknown }>(unit: T | undefined) {
  if (!unit) return unit;
  const copy = { ...unit };
  delete copy.evidence;
  return copy;
}

test("extrai matrícula escaneada com área privativa coberta e apartamentos nrs", () => {
  const result = extractDevelopmentFromOcrText(`
    MAT.: 91.849 - Página 4 de 293.
    Registro da Incorporação do Empreendimento VITÓRIA ACÁCIA, que será construído em Fortaleza.
    Tipo A: TORRES 01 a 14 - Apartamentos nrs. 201, 202, 203, 204, 301, 302, 303, 304,
    com área privativa coberta padrão de 38,08m2, área real total de 65,853768m2 e fração ideal de 0,003540265.
    Tipo B: TORRES 01, 02, 05 a 08, 10, 12 e 14 - Apartamentos nrs. 101 e 104,
    com área privativa coberta padrão de 39,08m2, área privativa total de 50,99m2,
    área real total de 79,705393m2 e fração ideal de 0,003660292.
  `);

  assert.equal(result.name, "Vitoria Acacia");
  assert.equal(result.registration, "91849");
  assert.ok(result.units.some((unit) => unit.typology === "Tipo A" && unit.privateArea === "38,08"));
  assert.ok(result.units.some((unit) => unit.typology === "Tipo B" && unit.idealFraction === "0,003660292"));
});
