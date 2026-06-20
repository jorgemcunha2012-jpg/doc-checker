import type { ChecklistField, ValidationType } from "./validation";

const minutaFields: ChecklistField[] = [
  { id: "buyer.name", category: "Dados do comprador", label: "Nome", required: true, validationType: "MINUTA" },
  { id: "buyer.cpf", category: "Dados do comprador", label: "CPF", required: true, validationType: "MINUTA" },
  { id: "buyer.rg", category: "Dados do comprador", label: "RG", required: true, validationType: "MINUTA" },
  { id: "buyer.maritalStatus", category: "Dados do comprador", label: "Estado civil", required: true, validationType: "MINUTA" },
  { id: "buyer.address", category: "Dados do comprador", label: "Endereço", required: true, validationType: "MINUTA" },
  { id: "property.development", category: "Dados do imóvel", label: "Empreendimento", required: true, validationType: "MINUTA" },
  { id: "property.registration", category: "Dados do imóvel", label: "Matrícula", required: true, validationType: "MINUTA" },
  { id: "property.unit", category: "Dados do imóvel", label: "Unidade", required: true, validationType: "MINUTA" },
  { id: "property.tower", category: "Dados do imóvel", label: "Torre", required: true, validationType: "MINUTA" },
  { id: "property.idealFraction", category: "Dados do imóvel", label: "Fração ideal", required: true, validationType: "MINUTA" },
  { id: "property.areas", category: "Dados do imóvel", label: "Áreas", required: true, validationType: "MINUTA" },
  { id: "financial.downPayment", category: "Dados financeiros", label: "Entrada", required: true, validationType: "MINUTA" },
  { id: "financial.financing", category: "Dados financeiros", label: "Financiamento", required: true, validationType: "MINUTA" },
  { id: "financial.fgts", category: "Dados financeiros", label: "FGTS", required: false, validationType: "MINUTA" },
  { id: "financial.subsidy", category: "Dados financeiros", label: "Subsídio", required: false, validationType: "MINUTA" },
  { id: "financial.totalValue", category: "Dados financeiros", label: "Valor total", required: true, validationType: "MINUTA" },
  { id: "clauses.required", category: "Cláusulas e assinaturas", label: "Cláusulas obrigatórias", required: true, validationType: "MINUTA" },
  { id: "signatures.present", category: "Cláusulas e assinaturas", label: "Assinaturas", required: true, validationType: "MINUTA" },
];

const itbiFields: ChecklistField[] = [
  { id: "buyer.name", category: "Dados do adquirente", label: "Nome", required: true, validationType: "ITBI" },
  { id: "buyer.cpf", category: "Dados do adquirente", label: "CPF", required: true, validationType: "ITBI" },
  { id: "buyer.address", category: "Dados do adquirente", label: "Endereço", required: true, validationType: "ITBI" },
  { id: "buyer.email", category: "Dados do adquirente", label: "Email", required: true, validationType: "ITBI" },
  { id: "buyer.phone", category: "Dados do adquirente", label: "Telefone", required: true, validationType: "ITBI" },
  { id: "seller.legalName", category: "Dados do transmitente", label: "Razão social", required: true, validationType: "ITBI" },
  { id: "seller.cnpj", category: "Dados do transmitente", label: "CNPJ", required: true, validationType: "ITBI" },
  { id: "seller.address", category: "Dados do transmitente", label: "Endereço", required: true, validationType: "ITBI" },
  { id: "property.registration", category: "Dados do imóvel", label: "Matrícula", required: true, validationType: "ITBI" },
  { id: "property.iptu", category: "Dados do imóvel", label: "IPTU", required: true, validationType: "ITBI" },
  { id: "property.address", category: "Dados do imóvel", label: "Endereço", required: true, validationType: "ITBI" },
  { id: "property.privateArea", category: "Dados do imóvel", label: "Área privativa", required: true, validationType: "ITBI" },
  { id: "property.commonArea", category: "Dados do imóvel", label: "Área comum", required: true, validationType: "ITBI" },
  { id: "property.totalArea", category: "Dados do imóvel", label: "Área total", required: true, validationType: "ITBI" },
  { id: "property.landArea", category: "Dados do imóvel", label: "Área do terreno", required: false, validationType: "ITBI" },
  { id: "property.idealFraction", category: "Dados do imóvel", label: "Fração ideal", required: true, validationType: "ITBI" },
  { id: "financial.declaredTotal", category: "Dados financeiros", label: "Valor total declarado", required: true, validationType: "ITBI" },
  { id: "financial.financedValue", category: "Dados financeiros", label: "Valor financiado", required: true, validationType: "ITBI" },
  { id: "financial.nonFinancedValue", category: "Dados financeiros", label: "Valor não financiado", required: true, validationType: "ITBI" },
  { id: "documents.identity", category: "Documentação", label: "Identidade", required: true, validationType: "ITBI" },
  { id: "documents.cpf", category: "Documentação", label: "CPF", required: true, validationType: "ITBI" },
  { id: "documents.addressProof", category: "Documentação", label: "Comprovante de endereço", required: true, validationType: "ITBI" },
  { id: "documents.maritalStatusProof", category: "Documentação", label: "Comprovante de estado civil", required: true, validationType: "ITBI" },
];

export const checklists: Record<ValidationType, ChecklistField[]> = {
  MINUTA: minutaFields,
  ITBI: itbiFields,
};

export function getChecklist(validationType: ValidationType) {
  return checklists[validationType];
}
