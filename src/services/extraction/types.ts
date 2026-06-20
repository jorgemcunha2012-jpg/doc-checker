import type { ExtractedDocumentData, ExtractionProvider, UploadedDocument, ValidationType } from "@/domain/validation";

export type ExtractionRequest = {
  validationType: ValidationType;
  documents: UploadedDocument[];
};

export type ExtractionResult = {
  provider: ExtractionProvider;
  sourceData: ExtractedDocumentData;
  targetData: ExtractedDocumentData;
  confidence: number;
};

export interface DocumentExtractionService {
  provider: ExtractionProvider;
  extract(request: ExtractionRequest): Promise<ExtractionResult>;
}
