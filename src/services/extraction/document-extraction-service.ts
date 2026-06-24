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
    const imageSources = participatingSources.filter((source) =>
      request.documents
        .filter((document) => document.source === source)
        .every((document) => document.mimeType.includes("image")),
    );
    const pdfSources = participatingSources.filter((source) => !imageSources.includes(source));
    const imageResultsPromise = Promise.all(
      imageSources.map((source) =>
        this.extractDocumentSource(
          source,
          request.documents.filter((document) => document.source === source),
          checklist,
        ),
      ),
    );
    const pdfResults = [];

    // DeepSeek may throttle concurrent large-document requests. Keep PDFs ordered
    // while image OCR continues independently through Kimi.
    for (const source of pdfSources) {
      pdfResults.push(
        await this.extractDocumentSource(
          source,
          request.documents.filter((document) => document.source === source),
          checklist,
        ),
      );
    }

    const sourceResults = [...pdfResults, ...(await imageResultsPromise)].sort(
      (left, right) => participatingSources.indexOf(left.source) - participatingSources.indexOf(right.source),
    );

    return {
      values: sourceResults.flatMap((result) => result.values),
      participatingSources,
      unreadableSources: sourceResults.filter((result) => result.unreadable).map((result) => result.source),
      sourceErrors: Object.fromEntries(
        sourceResults.filter((result) => result.error).map((result) => [result.source, result.error]),
      ),
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
            const text = await extractPdfText(document.buffer);
            if (!hasEnoughPdfText(text)) {
              return {
                output: null,
                usedPdfVisionFallback: true,
                error: "O PDF não possui texto extraível suficiente e o OCR visual ainda não está disponível neste fluxo.",
              };
            }
            return { output: await this.deepSeekProvider.structureText(text, checklist), usedPdfVisionFallback: false };
          }
          if (document.mimeType.includes("image")) {
            return { output: await this.kimiProvider.extractFromImage(document, checklist), usedPdfVisionFallback: false };
          }
          return { output: null, usedPdfVisionFallback: false, error: "Formato de arquivo não suportado." };
        } catch (error) {
          const errorMessage = sanitizeExtractionError(error);
          console.error("[ConferIA] Falha de extração por documento", {
            source,
            documentName: document.name,
            error: errorMessage,
          });
          return { output: null, usedPdfVisionFallback: false, error: errorMessage };
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
      error: attempts.find((attempt) => attempt.error)?.error,
      usedPdfVisionFallback: attempts.some((attempt) => attempt.usedPdfVisionFallback),
    };
  }
}

function sanitizeExtractionError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [oculto]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[chave oculta]")
    .slice(0, 500);
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
