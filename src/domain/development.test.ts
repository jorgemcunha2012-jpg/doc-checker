import assert from "node:assert/strict";
import test from "node:test";
import { developmentUnitValues, reviewDevelopmentExtraction } from "./development";

test("injeta área total e fração ideal do cadastro mestre na conferência", () => {
  const values = developmentUnitValues(
    { name: "Vitória Maracanaú", registration: "6426" },
    {
      id: "unit_1",
      developmentId: "dev_1",
      tower: "23",
      unit: "103",
      typology: "Tipo A",
      privateArea: "45,62 m²",
      commonArea: "12,48 m²",
      totalArea: "58,10 m²",
      idealFraction: "0,001234",
      confidence: 100,
    },
  );

  assert.equal(values.find((value) => value.fieldId === "property.privateArea")?.value, "45,62 m²");
  assert.equal(values.find((value) => value.fieldId === "property.commonArea")?.value, "12,48 m²");
  assert.equal(values.find((value) => value.fieldId === "property.totalArea")?.value, "58,10 m²");
  assert.equal(values.find((value) => value.fieldId === "property.idealFraction")?.value, "0,001234");
  assert.equal(values.find((value) => value.fieldId === "property.type")?.value, "Tipo A");
});

test("resume e bloqueia cadastro extraído quando há unidade incompleta", () => {
  const review = reviewDevelopmentExtraction({
    name: "Vitória Maracanaú",
    units: [
      { tower: "", unit: "", typology: "Tipo A", privateArea: "45,00", totalArea: "58,00", idealFraction: "0,10", confidence: 95 },
      { tower: "", unit: "", typology: "", privateArea: "45,00", totalArea: "58,00", idealFraction: "0,10", confidence: 65 },
      { tower: "", unit: "", typology: "Tipo B", privateArea: "55,00", totalArea: "70,00", idealFraction: "0,12", confidence: 90 },
    ],
  });

  assert.equal(review.towerCount, 0);
  assert.equal(review.unitCount, 3);
  assert.equal(review.typeCount, 2);
  assert.equal(review.incompleteUnits, 1);
  assert.equal(review.lowConfidenceUnits, 1);
  assert.equal(review.canSave, false);
});
