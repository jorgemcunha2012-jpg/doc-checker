import type { ChecklistField } from "./validation";

const fieldLabels: Record<string, string> = {
  "contract.number": "Número do contrato",
  "contract.date": "Data do contrato",
  "buyer.name": "Nome do comprador",
  "buyer.cpf": "CPF do comprador",
  "buyer.rg": "RG do comprador",
  "buyer.maritalStatus": "Estado civil do comprador",
  "buyer.address": "Endereço do comprador",
  "buyer.email": "E-mail do comprador",
  "buyer.phone": "Telefone do comprador",
  "seller.legalName": "Razão social do transmitente",
  "seller.cnpj": "CNPJ do transmitente",
  "seller.address": "Endereço do transmitente",
  "property.development": "Empreendimento",
  "property.registration": "Matrícula",
  "property.iptu": "Inscrição imobiliária/IPTU",
  "property.address": "Endereço do imóvel",
  "property.unit": "Unidade/apartamento",
  "property.tower": "Torre",
  "property.idealFraction": "Fração ideal",
  "property.areas": "Áreas do imóvel",
  "property.privateArea": "Área privativa",
  "property.commonArea": "Área comum",
  "property.totalArea": "Área total",
  "property.landArea": "Área do terreno",
  "financial.downPayment": "Entrada",
  "financial.financing": "Financiamento",
  "financial.financedValue": "Valor financiado",
  "financial.nonFinancedValue": "Valor não financiado",
  "financial.fgts": "FGTS",
  "financial.subsidy": "Subsídio",
  "financial.totalValue": "Valor total",
  "financial.declaredTotal": "Valor total declarado",
  "signature.city": "Cidade da assinatura",
  "fortaleza.guideNumber": "Número da guia",
  "fortaleza.assessmentValue": "Valor venal/base de cálculo",
};

/** Converts persisted/internal field IDs into labels suitable for end users. */
export function humanFieldLabel(fieldId: string, checklist?: ChecklistField[]) {
  const directLabel = checklist?.find((field) => field.id === fieldId)?.label;
  if (directLabel) return directLabel;

  // Repeated buyers are represented internally as `field::participantId`.
  const baseFieldId = fieldId.split("::", 1)[0];
  return fieldLabels[baseFieldId] ?? fieldId;
}
