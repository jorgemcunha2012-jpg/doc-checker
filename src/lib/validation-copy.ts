import type { ValidationStatus, ValidationType } from "@/domain/validation";

export const validationTypeCopy: Record<ValidationType, { title: string; shortTitle: string; description: string }> = {
  MINUTA: {
    title: "Conferência de Minuta",
    shortTitle: "Minuta",
    description: "Compare print operacional e contrato para validar comprador, imóvel, valores, cláusulas e assinaturas.",
  },
  ITBI: {
    title: "Conferência de ITBI",
    shortTitle: "ITBI",
    description: "Confira guia DTI/ITBI, contrato e documentos complementares com checklist próprio.",
  },
  RECONCILIATION: {
    title: "Reconciliação Documental",
    shortTitle: "Reconciliação",
    description: "Consolide SIOPI, Minuta e ITBI para identificar concordâncias, divergências, ausências e fontes ilegíveis.",
  },
};

export const statusCopy: Record<ValidationStatus, string> = {
  MATCH: "Conferido",
  DIVERGENCE: "Divergência",
  NOT_FOUND: "Não encontrado",
  NOT_APPLICABLE: "Não aplicável",
  REVIEW_REQUIRED: "Revisão necessária",
  SOURCE_UNREADABLE: "Fonte ilegível",
};
