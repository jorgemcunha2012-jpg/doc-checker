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

test("preenche recursos próprios e valor total da composição padronizada", () => {
  const checklist = getChecklist("RECONCILIATION");
  const output = {
    fields: checklist.map((field) => ({ fieldId: field.id, value: null, confidence: 0 })),
  };
  const text = [
    "B.4 - VALOR DE COMPOSIÇÃO DOS RECURSOS:",
    "O valor destinado à aquisição do imóvel é R$ 237.000,00, composto pelos valores abaixo:",
    "B.4.2 - Valor dos recursos próprios: | R$ 50.607,09",
  ].join("\n");

  const enriched = enrichStandardFinancialFields(output, text, checklist);

  assert.equal(enriched.fields.find((field) => field.fieldId === "financial.downPayment")?.value, "R$ 50.607,09");
  assert.equal(enriched.fields.find((field) => field.fieldId === "financial.totalValue")?.value, "R$ 237.000,00");
});

test("prioriza a sequência B.4 da minuta e gera evidência curta para o subsídio", () => {
  const output = enrichStandardFinancialFields({
    fields: [{ fieldId: "financial.subsidy", value: "R$ 25,00", confidence: 100, sourceLocation: { rawText: "trecho incorreto" } }],
  }, "[PÁGINA 2] B.4.1 - Financiamento: B.4.2 - Recursos próprios: B.4.3 - FGTS: B.4.4 - FGTS Futuro: B.4.5 - Subsídio: R$ 186.400,00 R$ 28.063,18 R$ 19.536,82 R$ 0,00 R$ 0,00 B.5 - Despesas", [
    { id: "financial.subsidy", category: "Dados financeiros", label: "Subsídio", required: false, validationType: "MINUTA", fieldType: "valor_monetario", itemType: "COMPARISON" },
  ]);

  assert.equal(output.fields[0].value, "R$ 0,00");
  assert.equal(output.fields[0].sourceLocation?.page, 2);
  assert.match(output.fields[0].sourceLocation?.rawText ?? "", /B\.4\.5/);
  assert.doesNotMatch(output.fields[0].sourceLocation?.rawText ?? "", /trecho incorreto/);
});
