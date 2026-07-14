import assert from "node:assert/strict";
import test from "node:test";
import { reconcileDevelopmentExtractions } from "./development-reconciliation";

const unit = (privateArea: string, confidence = 90) => ({
  tower: "01",
  unit: "101",
  privateArea,
  totalArea: "65,85",
  idealFraction: "0,003",
  typology: "Tipo A",
  confidence,
});

test("confirma unidade quando OCR e visão concordam", () => {
  const result = reconcileDevelopmentExtractions(
    { name: "Acacia", units: [unit("38,08")] },
    { name: "Acacia", units: [unit("38,08", 92)] },
  );

  assert.equal(result?.units[0].confidence, 97);
  assert.deepEqual(result?.quality?.reviewRequired, []);
});

test("encaminha divergência entre OCR e visão para revisão direcionada", () => {
  const result = reconcileDevelopmentExtractions(
    { name: "Acacia", units: [unit("38,08")] },
    { name: "Acacia", units: [unit("39,08")] },
  );

  assert.equal(result?.units[0].confidence, 69);
  assert.match(result?.quality?.reviewRequired[0] ?? "", /divergência entre OCR e visão/);
});

