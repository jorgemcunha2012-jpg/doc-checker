export type ValidationType = "MINUTA" | "ITBI" | "RECONCILIATION";

export type DocumentSource =
  | "SIOPI"
  | "MINUTA"
  | "ITBI"
  | "DADOS_RESERVA"
  | "CADASTRO_EMPREENDIMENTO"
  | "MATRICULA"
  | "CERTIDAO"
  | "DOCUMENTO_COMPLEMENTAR";

export const activeDocumentSources: DocumentSource[] = [
  "SIOPI",
  "MINUTA",
  "ITBI",
  "DADOS_RESERVA",
  "CADASTRO_EMPREENDIMENTO",
  "MATRICULA",
  "CERTIDAO",
  "DOCUMENTO_COMPLEMENTAR",
];

export const uploadDocumentSources = activeDocumentSources.filter(
  (source) => source !== "CADASTRO_EMPREENDIMENTO",
);

export const documentSourceLabels: Record<DocumentSource, string> = {
  SIOPI: "Espelho SIOPI",
  MINUTA: "Minuta",
  ITBI: "ITBI",
  DADOS_RESERVA: "Dados da Reserva",
  CADASTRO_EMPREENDIMENTO: "Cadastro do Empreendimento",
  MATRICULA: "Matrícula",
  CERTIDAO: "Certidão",
  DOCUMENTO_COMPLEMENTAR: "Documento complementar",
};

export type ValidationStatus =
  | "MATCH"
  | "DIVERGENCE"
  | "NOT_FOUND"
  | "NOT_APPLICABLE"
  | "REVIEW_REQUIRED"
  | "SOURCE_UNREADABLE";

export type ValidationProcessStatus = "PENDING" | "EXTRACTING" | "COMPARING" | "DONE" | "FAILED";

export type UserRole = "ADMIN" | "ANALISTA" | "REVISOR";

export type FieldType =
  | "texto"
  | "cpf"
  | "cnpj"
  | "valor_monetario"
  | "area"
  | "identificador_imovel"
  | "data"
  | "endereco"
  | "rg"
  | "telefone"
  | "email";

export type ChecklistItemType = "COMPARISON" | "DOCUMENT_ATTACHMENT" | "CLAUSE_PRESENCE" | "VALIDITY_CHECK";

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
  itemType: ChecklistItemType;
  scopeCondition?: string;
  allowMultiple?: boolean;
  expectedSources?: DocumentSource[];
  baseFieldId?: string;
  participantId?: string;
  participantLabel?: string;
};

export type ExtractedField = {
  fieldId: string;
  value: string | null;
  confidence: number;
  sourceLocation?: SourceLocation;
  participantId?: string;
};

export type SourceLocation = {
  page?: number;
  section?: string;
  rawText?: string;
};

export type ExtractedFieldValue = ExtractedField & {
  source: DocumentSource;
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
  type: "PRINT" | "IMAGE" | "PDF" | "WORD" | "TIFF" | "ITBI_GUIDE" | "CONTRACT" | "COMPLEMENTARY";
  mimeType: string;
  sizeBytes?: number;
  source?: DocumentSource;
  storagePath?: string;
};

export type ValidationSummary = {
  totalChecked: number;
  matches: number;
  divergences: number;
  reviewRequired: number;
};

export type LegacyValidationRun = {
  id: string;
  organizationId: string;
  validationType: "MINUTA" | "ITBI";
  checklist: ChecklistField[];
  results: ValidationResult[];
  summary: ValidationSummary;
  usedPdfVisionFallback: boolean;
};

export type ReconciliationStatus = "MATCH" | "DIVERGENCE" | "REVIEW_REQUIRED" | "SOURCE_UNREADABLE";
export type HumanReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type HumanReview = {
  status: Exclude<HumanReviewStatus, "PENDING">;
  justification: string;
  reviewerId: string;
  reviewerName: string;
  reviewedAt: string;
};

export type ReconciliationSourceValue = {
  value: string | null;
  normalizedValue: string;
  confidence: number;
  sourceLocation?: SourceLocation;
  diffTokens?: string[];
};

export type FieldComparisonResult = {
  organizationId: string;
  field: ChecklistField;
  valuesBySource: Partial<Record<DocumentSource, ReconciliationSourceValue>>;
  status: ReconciliationStatus;
  observation: string;
  humanReview?: HumanReview;
};

export type ReconciliationSummary = ValidationSummary & {
  unreadable: number;
  missingBySource: Partial<Record<DocumentSource, number>>;
  unreadableBySource: Partial<Record<DocumentSource, number>>;
};

export type ReconciliationRun = {
  id: string;
  organizationId: string;
  validationType: "RECONCILIATION";
  checklist: ChecklistField[];
  results: FieldComparisonResult[];
  summary: ReconciliationSummary;
  usedPdfVisionFallback: boolean;
  participatingSources: DocumentSource[];
};

export type ValidationRun = LegacyValidationRun | ReconciliationRun;

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
