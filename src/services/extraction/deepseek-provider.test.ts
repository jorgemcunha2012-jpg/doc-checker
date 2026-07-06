import assert from "node:assert/strict";
import test from "node:test";
import { getChecklist } from "@/domain/checklists";
import { enrichStandardFinancialFields, focusDocumentText } from "./deepseek-provider";

test("preserva a seção financeira no contexto de contratos extensos", () => {
  const qualification = "COMPRADOR CPF RG ENDEREÇO ESTADO CIVIL ".repeat(500);
  const property = "IMÓVEL MATRÍCULA TORRE UNIDADE ÁREA EMPREENDIMENTO ".repeat(500);
  const financial = [
    "B.4 - VALOR DE COMPOSIÇÃO DOS RECURSOS:",
    "B.4.1 - Valor do financiamento concedido pela CAIXA: | R$ 114.616,91",
    "B.4.2 - Valor dos recursos próprios: | R$ 50.607,09",
    "B.4.5 - Valor do desconto complemento concedido pelo FGTS/União: | R$ 51.776,00",
  ].join("\n");
  const clauses = "CONTRATO CLÁUSULA GARANTIA ASSINATURA ".repeat(500);
  const text = [qualification, property, financial, clauses].join("\n\n");

  const focused = focusDocumentText(text, getChecklist("RECONCILIATION"));

  assert.ok(focused.length <= 13_500);
  assert.match(focused, /B\.4\.1 - Valor do financiamento concedido pela CAIXA: \| R\$ 114\.616,91/);
});

test("preenche financiamento padronizado quando o provider omite o campo", () => {
  const checklist = getChecklist("RECONCILIATION");
  const output = {
    fields: checklist.map((field) => ({ fieldId: field.id, value: null, confidence: 0 })),
  };
  const text = "B.4.1 - Valor do financiamento concedido pela CAIXA: | R$ 114.616,91";

  const enriched = enrichStandardFinancialFields(output, text, checklist);
  const financing = enriched.fields.find((field) => field.fieldId === "financial.financing");

  assert.equal(financing?.value, "R$ 114.616,91");
  assert.equal(financing?.confidence, 100);
  assert.match(financing?.sourceLocation?.rawText ?? "", /B\.4\.1/);
});
