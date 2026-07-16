import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import { DocumentExtractionService } from "./document-extraction-service";

test("preserva a extração determinística do DTI quando o provider demora ou falha", async () => {
  const service = new DocumentExtractionService(
    {} as never,
    { structureText: async () => { throw new Error("timeout"); } } as never,
  );

  const result = await (service as unknown as {
    extractTextWithRecovery: (text: string, checklist: ReturnType<typeof getChecklist>, source: "ITBI") => Promise<{ output: { fields: Array<{ fieldId: string; value: string | null }> } }>;
  }).extractTextWithRecovery(
    [
      "Nome: JOAO ERIC ANTONIO BEZERRA OLIVEIRA",
      "CPFCNPJ: 028.349.913-32",
      "Text1: SPE CAUCAIA CT EMPREENDIMENTOS IMOBILIARIOS LTDA",
      "Text2: 53.635.373/0001-03",
      "Inscrição do IPTU: 147158-9",
      "Text3: RUA TABUZIOS, TABUBA, CAUCAIA/CE",
      "Text4: 69465",
      "Área do terreno m²: 10.006,00",
      "Área privativa m²: 48,19m²",
      "Área comum m²: 41,524337m²",
      "Área total m²: 89,714337m²",
      "Complemento: T3, AP 201",
      "Valor Financiado: 360.000,00",
      "Valor Não Financiado: 55.000,00",
      "Valor Total Declarado: 415.000,00",
    ].join("\n"),
    getChecklist("RECONCILIATION"),
    "ITBI",
  );

  assert.equal(result.output.fields.find((field) => field.fieldId === "property.landArea")?.value, "10.006,00");
  assert.equal(result.output.fields.find((field) => field.fieldId === "property.registration")?.value, "69465");
  assert.equal(result.output.fields.find((field) => field.fieldId === "financial.financing")?.value, "360.000,00");
});
