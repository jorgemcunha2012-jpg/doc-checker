export type ValidationType = "MINUTA" | "ITBI";

export type ValidationStatus =
  | "MATCH"
  | "DIVERGENCE"
  | "NOT_FOUND"
  | "NOT_APPLICABLE"
  | "REVIEW_REQUIRED";

export type ValidationProcessStatus = "PENDING" | "EXTRACTING" | "COMPARING" | "DONE" | "FAILED";

export type UserRole = "ADMIN" | "ANALISTA" | "REVISOR";

export type FieldType =
  | "texto"
  | "cpf"
  | "cnpj"
  | "valor_monetario"
  | "data"
  | "endereco"
  | "rg"
  | "telefone"
  | "email";

export type ChecklistCategory =
  | "Identificação do contrato"
  | "Dados do comprador"
  | "Dados do adquirente"
  | "Dados do transmitente"
  | "Dados do imóvel"
  | "Dados financeiros"
  | "Declaração de valores"
  | "Guias Fortaleza"
  | "Página de assinaturas";

export type Organization = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
};

export type ChecklistField = {
  id: string;
  category: ChecklistCategory;
  label: string;
  required: boolean;
  validationType: ValidationType;
  fieldType: FieldType;
  scopeCondition?: string;
  allowMultiple?: boolean;
};

export type ExtractedField = {
  fieldId: string;
  value: string | null;
  confidence: number;
};

export type ProviderExtractionOutput = {
  fields: ExtractedField[];
};

export type ValidationResult = {
  organizationId: string;
  field: ChecklistField;
  sourceValue: string;
  targetValue: string;
  sourceValueNormalized: string;
  targetValueNormalized: string;
  sourceDiffTokens?: string[];
  targetDiffTokens?: string[];
  sourceConfidence: number;
  targetConfidence: number;
  status: ValidationStatus;
  observation: string;
};

export type ExtractedDocumentData = Record<string, ExtractedField | undefined>;

export type UploadedDocument = {
  id: string;
  organizationId: string;
  name: string;
  type: "PRINT" | "IMAGE" | "PDF" | "ITBI_GUIDE" | "CONTRACT" | "COMPLEMENTARY";
  mimeType: string;
  sizeBytes?: number;
};

export type ValidationSummary = {
  totalChecked: number;
  divergences: number;
  reviewRequired: number;
};

export type ValidationRun = {
  id: string;
  organizationId: string;
  validationType: ValidationType;
  checklist: ChecklistField[];
  results: ValidationResult[];
  summary: ValidationSummary;
  usedPdfVisionFallback: boolean;
};

export type ValidationProcess = {
  id: string;
  organizationId: string;
  userId: string;
  validationType: ValidationType;
  status: ValidationProcessStatus;
  documents: UploadedDocument[];
  result?: ValidationRun;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtractionProvider = "KIMI" | "DEEPSEEK";
