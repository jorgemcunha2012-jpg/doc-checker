import type { ChecklistField, FieldType, ValidationType } from "./validation";

function field(
  id: string,
  category: ChecklistField["category"],
  label: string,
  required: boolean,
  validationType: ValidationType,
  fieldType: FieldType,
  options: Pick<ChecklistField, "scopeCondition" | "allowMultiple"> = {},
): ChecklistField {
  return { id, category, label, required, validationType, fieldType, itemType: "COMPARISON", ...options };
}

const minutaFields: ChecklistField[] = [
  field("contract.number", "Identificação do contrato", "Número do contrato", true, "MINUTA", "texto"),
  field("contract.date", "Identificação do contrato", "Data do contrato", false, "MINUTA", "data"),
  field("buyer.name", "Dados do comprador", "Nome", true, "MINUTA", "texto", { allowMultiple: true }),
  field("buyer.cpf", "Dados do comprador", "CPF", true, "MINUTA", "cpf", { allowMultiple: true }),
  field("buyer.rg", "Dados do comprador", "RG", true, "MINUTA", "rg", { allowMultiple: true }),
  field("buyer.maritalStatus", "Dados do comprador", "Estado civil", true, "MINUTA", "texto", { allowMultiple: true }),
  field("buyer.address", "Dados do comprador", "Endereço", true, "MINUTA", "endereco", { allowMultiple: true }),
  field("property.development", "Dados do imóvel", "Empreendimento", true, "MINUTA", "texto"),
  field("property.registration", "Dados do imóvel", "Matrícula", true, "MINUTA", "texto"),
  field("property.unit", "Dados do imóvel", "Unidade", true, "MINUTA", "texto"),
  field("property.tower", "Dados do imóvel", "Torre", true, "MINUTA", "texto"),
  field("property.idealFraction", "Dados do imóvel", "Fração ideal", true, "MINUTA", "valor_monetario"),
  field("property.areas", "Dados do imóvel", "Áreas", true, "MINUTA", "texto"),
  field("financial.downPayment", "Dados financeiros", "Entrada", true, "MINUTA", "valor_monetario"),
  field("financial.financing", "Dados financeiros", "Financiamento", true, "MINUTA", "valor_monetario"),
  field("financial.fgts", "Dados financeiros", "FGTS", false, "MINUTA", "valor_monetario"),
  field("financial.subsidy", "Dados financeiros", "Subsídio", false, "MINUTA", "valor_monetario"),
  field("financial.totalValue", "Dados financeiros", "Valor total", true, "MINUTA", "valor_monetario"),
  field("signature.city", "Página de assinaturas", "Cidade conforme local da agência do cliente", true, "MINUTA", "texto"),
];

const itbiFields: ChecklistField[] = [
  field("buyer.name", "Dados do adquirente", "Nome", true, "ITBI", "texto", { allowMultiple: true }),
  field("buyer.cpf", "Dados do adquirente", "CPF", true, "ITBI", "cpf", { allowMultiple: true }),
  field("buyer.address", "Dados do adquirente", "Endereço", true, "ITBI", "endereco", { allowMultiple: true }),
  field("buyer.email", "Dados do adquirente", "Email", true, "ITBI", "email", { allowMultiple: true }),
  field("buyer.phone", "Dados do adquirente", "Telefone", true, "ITBI", "telefone", { allowMultiple: true }),
  field("seller.legalName", "Dados do transmitente", "Razão social", true, "ITBI", "texto"),
  field("seller.cnpj", "Dados do transmitente", "CNPJ", true, "ITBI", "cnpj"),
  field("seller.address", "Dados do transmitente", "Endereço", true, "ITBI", "endereco"),
  field("property.registration", "Dados do imóvel", "Matrícula", true, "ITBI", "texto"),
  field("property.iptu", "Dados do imóvel", "IPTU", true, "ITBI", "texto"),
  field("property.address", "Dados do imóvel", "Endereço", true, "ITBI", "endereco"),
  field("property.privateArea", "Dados do imóvel", "Área privativa", true, "ITBI", "texto"),
  field("property.commonArea", "Dados do imóvel", "Área comum", true, "ITBI", "texto"),
  field("property.totalArea", "Dados do imóvel", "Área total", true, "ITBI", "texto"),
  field("property.landArea", "Dados do imóvel", "Área do terreno", false, "ITBI", "texto"),
  field("property.idealFraction", "Dados do imóvel", "Fração ideal", true, "ITBI", "valor_monetario"),
  field("financial.declaredTotal", "Declaração de valores", "Valor total declarado", true, "ITBI", "valor_monetario"),
  field("financial.financedValue", "Declaração de valores", "Valor financiado", true, "ITBI", "valor_monetario"),
  field("financial.nonFinancedValue", "Declaração de valores", "Valor não financiado", true, "ITBI", "valor_monetario"),
  field("fortaleza.guideNumber", "Guias Fortaleza", "Número da guia", false, "ITBI", "texto", { scopeCondition: "Aplicável para processos emitidos em Fortaleza." }),
  field("fortaleza.assessmentValue", "Guias Fortaleza", "Valor venal/base de cálculo", false, "ITBI", "valor_monetario", {
    scopeCondition: "Aplicável para processos emitidos em Fortaleza.",
  }),
];

export const checklists: Record<ValidationType, ChecklistField[]> = {
  MINUTA: minutaFields,
  ITBI: itbiFields,
};

export function getChecklist(validationType: ValidationType) {
  return checklists[validationType];
}
