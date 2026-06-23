import { getChecklist } from "@/domain/checklists";
import type { DocumentSource, ExtractedFieldValue, ProviderExtractionOutput } from "@/domain/validation";
import { normalizeValue } from "@/services/normalization/normalization-service";
import { DeepSeekProvider } from "./deepseek-provider";
import { KimiProvider } from "./kimi-provider";
import { extractPdfText, hasEnoughPdfText } from "./pdf-text-service";
import type { ExtractionRequest, ExtractionResult, ReconciliationExtractionResult, UploadedDocumentPayload } from "./types";

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

    const [sourceData, targetExtraction] = await Promise.all([
      this.extractSourceData(sourceDocuments, checklist),
      this.extractTargetData(targetDocuments, checklist),
    ]);

    return {
      provider: targetExtraction.usedPdfVisionFallback ? "MIXED" : "DEEPSEEK",
      sourceData,
      targetData: targetExtraction.data,
      usedPdfVisionFallback: targetExtraction.usedPdfVisionFallback,
    };
  }

  async extractReconciliation(request: ExtractionRequest): Promise<ReconciliationExtractionResult> {
    const checklist = getChecklist("RECONCILIATION");
    const participatingSources = Array.from(
      new Set(request.documents.map((document) => document.source).filter((source): source is DocumentSource => Boolean(source))),
    );
    const sourceResults = await Promise.all(
      participatingSources.map(async (source) => {
        const documents = request.documents.filter((document) => document.source === source);
        return this.extractDocumentSource(source, documents, checklist);
      }),
    );

    return {
      values: sourceResults.flatMap((result) => result.values),
      participatingSources,
      unreadableSources: sourceResults.filter((result) => result.unreadable).map((result) => result.source),
      conflictedFieldsBySource: Object.fromEntries(
        sourceResults.filter((result) => result.conflictedFields.length).map((result) => [result.source, result.conflictedFields]),
      ),
      usedPdfVisionFallback: sourceResults.some((result) => result.usedPdfVisionFallback),
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

  private async extractDocumentSource(
    source: DocumentSource,
    documents: UploadedDocumentPayload[],
    checklist: ExtractionRequest["checklist"],
  ) {
    const attempts = await Promise.all(
      documents.map(async (document) => {
        try {
          const isPdf = document.mimeType.includes("pdf") || document.name.toLowerCase().endsWith(".pdf");
          if (isPdf) {
            const text = await tryExtractPdfText(document.buffer);
            if (!hasEnoughPdfText(text)) {
              return { output: null, usedPdfVisionFallback: true };
            }
            return { output: await this.deepSeekProvider.structureText(text, checklist), usedPdfVisionFallback: false };
          }
          if (document.mimeType.includes("image")) {
            return { output: await this.kimiProvider.extractFromImage(document, checklist), usedPdfVisionFallback: false };
          }
          return { output: null, usedPdfVisionFallback: false };
        } catch {
          return { output: null, usedPdfVisionFallback: false };
        }
      }),
    );
    const outputs = attempts.flatMap((attempt) => (attempt.output ? [attempt.output] : []));
    const consolidated = consolidateSourceOutputs(source, outputs, checklist);

    return {
      source,
      values: consolidated.values,
      conflictedFields: consolidated.conflictedFields,
      unreadable: outputs.length === 0,
      usedPdfVisionFallback: attempts.some((attempt) => attempt.usedPdfVisionFallback),
    };
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

function consolidateSourceOutputs(
  source: DocumentSource,
  outputs: ProviderExtractionOutput[],
  checklist: ExtractionRequest["checklist"],
) {
  const conflictedFields: string[] = [];
  const values: ExtractedFieldValue[] = checklist.map((field) => {
    const candidates = outputs
      .flatMap((output) => output.fields)
      .filter((candidate) => candidate.fieldId === field.id && candidate.value != null && String(candidate.value).trim());
    const distinctValues = new Set(
      candidates.map((candidate) => normalizeValue(String(candidate.value), field.fieldType)),
    );
    if (distinctValues.size > 1) conflictedFields.push(field.id);
    const best = candidates.sort((left, right) => right.confidence - left.confidence)[0];

    return {
      fieldId: field.id,
      source,
      value: best?.value ?? null,
      confidence: best?.confidence ?? 0,
      sourceLocation: best?.sourceLocation,
    };
  });

  return { values, conflictedFields };
}
