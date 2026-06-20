export type ValidationType = "MINUTA" | "ITBI";

export type ValidationStatus =
  | "MATCH"
  | "DIVERGENCE"
  | "NOT_FOUND"
  | "NOT_APPLICABLE"
  | "REVIEW_REQUIRED";

export type ChecklistCategory =
  | "Dados do comprador"
  | "Dados do adquirente"
  | "Dados do transmitente"
  | "Dados do imóvel"
  | "Dados financeiros"
  | "Documentação"
  | "Cláusulas e assinaturas";

export type ChecklistField = {
  id: string;
  category: ChecklistCategory;
  label: string;
  required: boolean;
  validationType: ValidationType;
};

export type ValidationResult = {
  field: ChecklistField;
  sourceValue: string;
  targetValue: string;
  status: ValidationStatus;
  observation: string;
};

export type ExtractedDocumentData = Record<string, string | undefined>;

export type UploadedDocument = {
  id: string;
  name: string;
  type: "PRINT" | "IMAGE" | "PDF" | "ITBI_GUIDE" | "CONTRACT" | "COMPLEMENTARY";
  mimeType: string;
};

export type ValidationSummary = {
  totalChecked: number;
  divergences: number;
  reviewRequired: number;
};

export type ValidationRun = {
  id: string;
  validationType: ValidationType;
  checklist: ChecklistField[];
  results: ValidationResult[];
  summary: ValidationSummary;
};

export type ExtractionProvider = "MOCK" | "OPENAI" | "OCR" | "AZURE_DOCUMENT_INTELLIGENCE" | "AWS_TEXTRACT";
