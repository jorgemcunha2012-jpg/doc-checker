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
  assert.equal(result.units.length, 14);
  assert.deepEqual(result.units.find((unit) => unit.tower === "02" && unit.unit === "204"), {
    tower: "02",
    unit: "204",
    privateArea: "38,08",
    totalArea: "72,656616",
    idealFraction: "0,0022143433",
    typology: "Tipo A",
    confidence: 88,
  });
  assert.deepEqual(result.units.find((unit) => unit.tower === "11" && unit.unit === "104"), {
    tower: "11",
    unit: "104",
    privateArea: "50,43",
    totalArea: "86,127996",
    idealFraction: "0,0022861583",
    typology: "Tipo B",
    confidence: 88,
  });
});

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
  assert.ok(result.units.some((unit) => unit.tower === "01" && unit.unit === "201" && unit.privateArea === "38,08"));
  assert.ok(result.units.some((unit) => unit.tower === "14" && unit.unit === "204" && unit.idealFraction === "0,003540265"));
  assert.ok(result.units.some((unit) => unit.tower === "05" && unit.unit === "101" && unit.privateArea === "39,08"));
});
