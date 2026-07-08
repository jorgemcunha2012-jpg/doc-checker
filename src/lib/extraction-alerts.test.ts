import assert from "node:assert/strict";
import test from "node:test";
import { extractionAlert } from "./extraction-alerts";

test("marca extração zerada como alerta crítico para admin", () => {
  const alert = extractionAlert({
    final_status: "PENDING_REVIEW",
    summary: {
      extractionQualityBySource: {
        DADOS_RESERVA: {
          source: "DADOS_RESERVA",
          status: "FAILED",
          coverage: 0,
          expectedCriticalFields: ["buyer.name"],
          extractedCriticalFields: [],
          missingCriticalFields: ["buyer.name"],
          lowConfidenceCriticalFields: [],
          ambiguousCriticalFields: [],
          recoveredFields: [],
          deterministicFields: [],
        },
      },
    },
  });

  assert.equal(alert?.severity, "critical");
  assert.match(alert?.label ?? "", /Extração não ocorreu/);
  assert.match(alert?.detail ?? "", /Cobertura mínima 0%/);
});
