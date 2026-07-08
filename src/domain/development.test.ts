import assert from "node:assert/strict";
import test from "node:test";
import { developmentUnitValues } from "./development";

test("injeta área total e fração ideal do cadastro mestre na conferência", () => {
  const values = developmentUnitValues(
    { name: "Vitória Maracanaú", registration: "6426" },
    {
      id: "unit_1",
      developmentId: "dev_1",
      tower: "23",
      unit: "103",
      privateArea: "45,62 m²",
      totalArea: "58,10 m²",
      idealFraction: "0,001234",
      confidence: 100,
    },
  );

  assert.equal(values.find((value) => value.fieldId === "property.privateArea")?.value, "45,62 m²");
  assert.equal(values.find((value) => value.fieldId === "property.totalArea")?.value, "58,10 m²");
  assert.equal(values.find((value) => value.fieldId === "property.idealFraction")?.value, "0,001234");
});
