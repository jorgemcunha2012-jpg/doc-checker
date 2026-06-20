import type { DocumentExtractionService } from "./types";

export interface OpenAIExtractionService extends DocumentExtractionService {
  provider: "OPENAI";
}

export interface OcrExtractionService extends DocumentExtractionService {
  provider: "OCR";
}

export interface AzureDocumentIntelligenceService extends DocumentExtractionService {
  provider: "AZURE_DOCUMENT_INTELLIGENCE";
}

export interface AwsTextractExtractionService extends DocumentExtractionService {
  provider: "AWS_TEXTRACT";
}
