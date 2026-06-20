import type {
  ChecklistField,
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

export interface DocumentExtractionProvider {
  provider: ExtractionProvider;
}
