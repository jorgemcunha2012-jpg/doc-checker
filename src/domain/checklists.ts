import type { ChecklistField, FieldType, ValidationType } from "./validation";

function field(
  id: string,
  category: ChecklistField["category"],
  label: string,
  required: boolean,
  validationType: ValidationType,
  fieldType: FieldType,
): ChecklistField {
  return { id, category, label, required, validationType, fieldType };
}

const minutaFields: ChecklistField[] = [
  field("buyer.name", "Dados do comprador", "Nome", true, "MINUTA", "texto"),
  field("buyer.cpf", "Dados do comprador", "CPF", true, "MINUTA", "cpf"),
  field("buyer.rg", "Dados do comprador", "RG", true, "MINUTA", "rg"),
  field("buyer.maritalStatus", "Dados do comprador", "Estado civil", true, "MINUTA", "texto"),
  field("buyer.address", "Dados do comprador", "Endereço", true, "MINUTA", "endereco"),
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
  field("clauses.required", "Cláusulas e assinaturas", "Cláusulas obrigatórias", true, "MINUTA", "texto"),
  field("signatures.present", "Cláusulas e assinaturas", "Assinaturas", true, "MINUTA", "texto"),
];

const itbiFields: ChecklistField[] = [
  field("buyer.name", "Dados do adquirente", "Nome", true, "ITBI", "texto"),
  field("buyer.cpf", "Dados do adquirente", "CPF", true, "ITBI", "cpf"),
  field("buyer.address", "Dados do adquirente", "Endereço", true, "ITBI", "endereco"),
  field("buyer.email", "Dados do adquirente", "Email", true, "ITBI", "email"),
  field("buyer.phone", "Dados do adquirente", "Telefone", true, "ITBI", "telefone"),
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
  field("financial.declaredTotal", "Dados financeiros", "Valor total declarado", true, "ITBI", "valor_monetario"),
  field("financial.financedValue", "Dados financeiros", "Valor financiado", true, "ITBI", "valor_monetario"),
  field("financial.nonFinancedValue", "Dados financeiros", "Valor não financiado", true, "ITBI", "valor_monetario"),
  field("documents.identity", "Documentação", "Identidade", true, "ITBI", "texto"),
  field("documents.cpf", "Documentação", "CPF", true, "ITBI", "texto"),
  field("documents.addressProof", "Documentação", "Comprovante de endereço", true, "ITBI", "texto"),
  field("documents.maritalStatusProof", "Documentação", "Comprovante de estado civil", true, "ITBI", "texto"),
];

export const checklists: Record<ValidationType, ChecklistField[]> = {
  MINUTA: minutaFields,
  ITBI: itbiFields,
};

export function getChecklist(validationType: ValidationType) {
  return checklists[validationType];
}
