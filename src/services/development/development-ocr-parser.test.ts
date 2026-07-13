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
