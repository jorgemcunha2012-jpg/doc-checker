import type { ChecklistField, DocumentSource, FieldType, ValidationType } from "./validation";

function field(
  id: string,
  category: ChecklistField["category"],
  label: string,
  required: boolean,
  validationType: ValidationType,
  fieldType: FieldType,
  options: Pick<ChecklistField, "scopeCondition" | "allowMultiple" | "expectedSources"> = {},
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
  field("buyer.address", "Dados do comprador", "Endereço residencial do comprador", true, "MINUTA", "endereco", { allowMultiple: true }),
  field("seller.legalName", "Dados do transmitente", "Razão social", true, "MINUTA", "texto"),
  field("seller.cnpj", "Dados do transmitente", "CNPJ", true, "MINUTA", "cnpj"),
  field("property.development", "Dados do imóvel", "Empreendimento", true, "MINUTA", "texto"),
  field("property.registration", "Dados do imóvel", "Matrícula", true, "MINUTA", "texto"),
  field("property.unit", "Dados do imóvel", "Unidade", true, "MINUTA", "identificador_imovel"),
  field("property.tower", "Dados do imóvel", "Torre", true, "MINUTA", "identificador_imovel"),
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
  field("buyer.address", "Dados do adquirente", "Endereço residencial do adquirente", true, "ITBI", "endereco", { allowMultiple: true }),
  field("buyer.email", "Dados do adquirente", "Email", true, "ITBI", "email", { allowMultiple: true }),
  field("buyer.phone", "Dados do adquirente", "Telefone", true, "ITBI", "telefone", { allowMultiple: true }),
  field("seller.legalName", "Dados do transmitente", "Razão social", true, "ITBI", "texto"),
  field("seller.cnpj", "Dados do transmitente", "CNPJ", true, "ITBI", "cnpj"),
  field("seller.address", "Dados do transmitente", "Endereço do transmitente", true, "ITBI", "endereco"),
  field("property.registration", "Dados do imóvel", "Matrícula", true, "ITBI", "texto"),
  field("property.iptu", "Dados do imóvel", "IPTU", true, "ITBI", "texto"),
  field("property.address", "Dados do imóvel", "Endereço do imóvel", true, "ITBI", "endereco"),
  field("property.privateArea", "Dados do imóvel", "Área privativa", true, "ITBI", "area"),
  field("property.commonArea", "Dados do imóvel", "Área comum", true, "ITBI", "area"),
  field("property.totalArea", "Dados do imóvel", "Área total", true, "ITBI", "area"),
  field("property.landArea", "Dados do imóvel", "Área do terreno", false, "ITBI", "area"),
  field("property.idealFraction", "Dados do imóvel", "Fração ideal", true, "ITBI", "valor_monetario"),
  field("financial.declaredTotal", "Declaração de valores", "Valor total declarado", true, "ITBI", "valor_monetario"),
  field("financial.financedValue", "Declaração de valores", "Valor financiado", true, "ITBI", "valor_monetario"),
  field("financial.nonFinancedValue", "Declaração de valores", "Valor não financiado", true, "ITBI", "valor_monetario"),
  field("fortaleza.guideNumber", "Guias Fortaleza", "Número da guia", false, "ITBI", "texto", { scopeCondition: "Aplicável para processos emitidos em Fortaleza." }),
  field("fortaleza.assessmentValue", "Guias Fortaleza", "Valor venal/base de cálculo", false, "ITBI", "valor_monetario", {
    scopeCondition: "Aplicável para processos emitidos em Fortaleza.",
  }),
];

const sourceMap: Record<string, DocumentSource[]> = {
  "contract.number": ["SIOPI", "MINUTA"],
  "contract.date": ["SIOPI", "MINUTA"],
  "buyer.name": ["SIOPI", "MINUTA", "ITBI", "DADOS_RESERVA"],
  "buyer.cpf": ["SIOPI", "MINUTA", "ITBI"],
  "buyer.rg": ["SIOPI", "MINUTA"],
  "buyer.maritalStatus": ["SIOPI", "MINUTA"],
  "buyer.address": ["SIOPI", "MINUTA", "ITBI"],
  "buyer.email": ["SIOPI", "ITBI", "DADOS_RESERVA"],
  "buyer.phone": ["SIOPI", "ITBI", "DADOS_RESERVA"],
  "seller.legalName": ["MINUTA", "ITBI", "MATRICULA", "CADASTRO_EMPREENDIMENTO"],
  "seller.cnpj": ["MINUTA", "ITBI", "MATRICULA", "CADASTRO_EMPREENDIMENTO"],
  "seller.address": ["MINUTA", "ITBI"],
  "property.development": ["SIOPI", "MINUTA", "ITBI", "DADOS_RESERVA", "CADASTRO_EMPREENDIMENTO"],
  "property.registration": ["SIOPI", "MINUTA", "ITBI", "DADOS_RESERVA", "CADASTRO_EMPREENDIMENTO"],
  "property.iptu": ["SIOPI", "MINUTA", "ITBI"],
  "property.address": ["SIOPI", "MINUTA", "ITBI"],
  "property.unit": ["SIOPI", "MINUTA", "ITBI", "DADOS_RESERVA", "CADASTRO_EMPREENDIMENTO"],
  "property.tower": ["SIOPI", "MINUTA", "ITBI", "DADOS_RESERVA", "CADASTRO_EMPREENDIMENTO"],
  "property.idealFraction": ["SIOPI", "MINUTA", "ITBI", "CADASTRO_EMPREENDIMENTO"],
  "property.areas": ["SIOPI", "MINUTA"],
  "property.privateArea": ["SIOPI", "MINUTA", "ITBI", "CADASTRO_EMPREENDIMENTO"],
  "property.commonArea": ["SIOPI", "MINUTA", "ITBI"],
  "property.totalArea": ["SIOPI", "MINUTA", "ITBI", "CADASTRO_EMPREENDIMENTO"],
  "property.landArea": ["MINUTA", "ITBI"],
  "financial.downPayment": ["SIOPI", "MINUTA", "DADOS_RESERVA"],
  "financial.financing": ["SIOPI", "MINUTA", "ITBI", "DADOS_RESERVA"],
  "financial.financedValue": ["SIOPI", "MINUTA", "ITBI"],
  "financial.nonFinancedValue": ["SIOPI", "MINUTA", "ITBI"],
  "financial.fgts": ["SIOPI", "MINUTA", "DADOS_RESERVA"],
  "financial.subsidy": ["SIOPI", "MINUTA", "DADOS_RESERVA"],
  "financial.totalValue": ["SIOPI", "MINUTA", "ITBI", "DADOS_RESERVA"],
  "financial.declaredTotal": ["SIOPI", "MINUTA", "ITBI"],
  "signature.city": ["SIOPI", "MINUTA"],
  "fortaleza.guideNumber": ["ITBI"],
  "fortaleza.assessmentValue": ["ITBI"],
};

const reconciliationFields: ChecklistField[] = Array.from(
  new Map(
    [...minutaFields, ...itbiFields]
      .filter((item) => item.id !== "financial.financedValue" && item.id !== "financial.declaredTotal")
      .map((item) => [item.id, item]),
  ).values(),
).map((item) => ({
  ...item,
  validationType: "RECONCILIATION",
  expectedSources: sourceMap[item.id] ?? ["SIOPI", "MINUTA", "ITBI"],
}));

export const checklists: Record<ValidationType, ChecklistField[]> = {
  MINUTA: minutaFields,
  ITBI: itbiFields,
  RECONCILIATION: reconciliationFields,
};

export function getChecklist(validationType: ValidationType) {
  return checklists[validationType];
}
