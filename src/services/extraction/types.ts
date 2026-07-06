import type {
  ChecklistField,
  DocumentSource,
  ExtractedFieldValue,
  ExtractionQualityReport,
  ExtractionProvider,
  ProviderExtractionOutput,
  UploadedDocument,
  ValidationType,
} from "@/domain/validation";

export type UploadedDocumentPayload = UploadedDocument & {
  buffer: Buffer;
};

export type ExtractionRequest = {
  validationType: ValidationType;
  checklist: ChecklistField[];
  documents: UploadedDocumentPayload[];
};

export type ExtractionResult = {
  provider: ExtractionProvider | "MIXED";
  sourceData: ProviderExtractionOutput;
  targetData: ProviderExtractionOutput;
  usedPdfVisionFallback: boolean;
};

export type ReconciliationExtractionResult = {
  values: ExtractedFieldValue[];
  participatingSources: DocumentSource[];
  unreadableSources: DocumentSource[];
  sourceErrors: Partial<Record<DocumentSource, string>>;
  conflictedFieldsBySource: Partial<Record<DocumentSource, string[]>>;
  qualityBySource: Partial<Record<DocumentSource, ExtractionQualityReport>>;
  usedPdfVisionFallback: boolean;
};

export interface DocumentExtractionProvider {
  provider: ExtractionProvider;
}
