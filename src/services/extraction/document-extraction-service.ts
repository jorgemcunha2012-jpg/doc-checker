import { getChecklist } from "@/domain/checklists";
import type { ProviderExtractionOutput } from "@/domain/validation";
import { DeepSeekProvider } from "./deepseek-provider";
import { KimiProvider } from "./kimi-provider";
import { extractPdfText, hasEnoughPdfText } from "./pdf-text-service";
import type { ExtractionRequest, ExtractionResult, UploadedDocumentPayload } from "./types";

export class DocumentExtractionService {
  constructor(
    private readonly kimiProvider = new KimiProvider(),
    private readonly deepSeekProvider = new DeepSeekProvider(),
  ) {}

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const checklist = getChecklist(request.validationType);
    const sourceDocuments = request.documents.filter((document) => document.type === "PRINT" || document.type === "IMAGE");
    const targetDocuments = request.documents.filter(
      (document) => document.type === "PDF" || document.type === "CONTRACT" || document.type === "ITBI_GUIDE" || document.type === "COMPLEMENTARY",
    );

    const sourceData = await this.extractSourceData(sourceDocuments, checklist);
    const targetExtraction = await this.extractTargetData(targetDocuments, checklist);

    return {
      provider: targetExtraction.usedPdfVisionFallback ? "MIXED" : "DEEPSEEK",
      sourceData,
      targetData: targetExtraction.data,
      usedPdfVisionFallback: targetExtraction.usedPdfVisionFallback,
    };
  }

  private async extractSourceData(documents: UploadedDocumentPayload[], checklist: ExtractionRequest["checklist"]): Promise<ProviderExtractionOutput> {
    if (!documents.length) {
      return emptyOutput(checklist);
    }

    const outputs = await Promise.all(documents.map((document) => this.kimiProvider.extractFromImage(document, checklist)));
    return mergeOutputs(outputs, checklist);
  }

  private async extractTargetData(documents: UploadedDocumentPayload[], checklist: ExtractionRequest["checklist"]) {
    if (!documents.length) {
      return { data: emptyOutput(checklist), usedPdfVisionFallback: false };
    }

    const outputs: ProviderExtractionOutput[] = [];
    let usedPdfVisionFallback = false;

    for (const document of documents) {
      if (document.mimeType.includes("pdf") || document.name.toLowerCase().endsWith(".pdf")) {
        const text = await tryExtractPdfText(document.buffer);

        if (hasEnoughPdfText(text)) {
          outputs.push(await this.deepSeekProvider.structureText(text, checklist));
        } else {
          usedPdfVisionFallback = true;
          outputs.push(emptyOutput(checklist));
        }
      } else if (document.mimeType.includes("image")) {
        outputs.push(await this.kimiProvider.extractFromImage(document, checklist));
      }
    }

    return { data: mergeOutputs(outputs, checklist), usedPdfVisionFallback };
  }
}

async function tryExtractPdfText(buffer: Buffer) {
  try {
    return await extractPdfText(buffer);
  } catch {
    return "";
  }
}

function emptyOutput(checklist: ExtractionRequest["checklist"]): ProviderExtractionOutput {
  return {
    fields: checklist.map((field) => ({
      fieldId: field.id,
      value: null,
      confidence: 0,
    })),
  };
}

function mergeOutputs(outputs: ProviderExtractionOutput[], checklist: ExtractionRequest["checklist"]): ProviderExtractionOutput {
  return {
    fields: checklist.map((field) => {
      const candidates = outputs
        .flatMap((output) => output.fields)
        .filter((extractedField) => extractedField.fieldId === field.id && extractedField.value);
      const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];

      return best ?? { fieldId: field.id, value: null, confidence: 0 };
    }),
  };
}
