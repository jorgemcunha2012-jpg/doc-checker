import { getChecklist } from "@/domain/checklists";
import { createHash } from "node:crypto";
import type { DocumentSource, ExtractedFieldValue, ProviderExtractionOutput } from "@/domain/validation";
import { normalizeValue } from "@/services/normalization/normalization-service";
import { DeepSeekProvider } from "./deepseek-provider";
import { KimiProvider } from "./kimi-provider";
import { extractPdfText, hasEnoughPdfText } from "./pdf-text-service";
import { extractDocxText } from "./word-text-service";
import { convertTiffToPngPages } from "./tiff-image-service";
import type { ExtractionRequest, ExtractionResult, ReconciliationExtractionResult, UploadedDocumentPayload } from "./types";
import { buildExtractionQuality, missingCriticalFields } from "./extraction-quality-service";

export class DocumentExtractionService {
  constructor(
    private readonly kimiProvider = new KimiProvider(),
    private readonly deepSeekProvider = new DeepSeekProvider(),
  ) {}

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const checklist = getChecklist(request.validationType);
    const sourceDocuments = request.documents.filter((document) => document.type === "PRINT" || document.type === "IMAGE" || document.type === "TIFF");
    const targetDocuments = request.documents.filter(
      (document) => document.type === "PDF" || document.type === "WORD" || document.type === "CONTRACT" || document.type === "ITBI_GUIDE" || document.type === "COMPLEMENTARY",
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
    const pdfResultsPromise = mapWithConcurrency(
      pdfSources,
      6,
      (source) =>
        this.extractDocumentSource(
          source,
          request.documents.filter((document) => document.source === source),
          checklist,
        ),
    );

    const sourceResults = [...(await pdfResultsPromise), ...(await imageResultsPromise)].sort(
      (left, right) => participatingSources.indexOf(left.source) - participatingSources.indexOf(right.source),
    );

    return {
      values: alignParticipantIdentities(sourceResults.flatMap((result) => result.values)),
      participatingSources,
      unreadableSources: sourceResults.filter((result) => result.unreadable).map((result) => result.source),
      sourceErrors: Object.fromEntries(
        sourceResults.filter((result) => result.error).map((result) => [result.source, result.error]),
      ),
      conflictedFieldsBySource: Object.fromEntries(
        sourceResults.filter((result) => result.conflictedFields.length).map((result) => [result.source, result.conflictedFields]),
      ),
      qualityBySource: Object.fromEntries(sourceResults.map((result) => [result.source, result.quality])),
      usedPdfVisionFallback: sourceResults.some((result) => result.usedPdfVisionFallback),
    };
  }

  private async extractSourceData(documents: UploadedDocumentPayload[], checklist: ExtractionRequest["checklist"]): Promise<ProviderExtractionOutput> {
    if (!documents.length) {
      return emptyOutput(checklist);
    }

    const outputs = await Promise.all(documents.map((document) => this.extractVisualDocument(document, checklist)));
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
      } else if (isDocx(document)) {
        outputs.push(await this.deepSeekProvider.structureText(await extractDocxText(document.buffer), checklist));
      } else if (document.mimeType.includes("image")) {
        outputs.push(await this.extractVisualDocument(document, checklist));
      }
    }

    return { data: mergeOutputs(outputs, checklist), usedPdfVisionFallback };
  }

  private async extractDocumentSource(
    source: DocumentSource,
    documents: UploadedDocumentPayload[],
    checklist: ExtractionRequest["checklist"],
  ) {
    // Every uploaded document is evidence. Keep the full checklist available
    // because complementary documents can contain fields outside their label.
    const sourceChecklist = checklist;
    const attempts = await Promise.all(
      documents.map(async (document) => {
        const startedAt = Date.now();
        try {
          const isPdf = document.mimeType.includes("pdf") || document.name.toLowerCase().endsWith(".pdf");
          if (isPdf) {
            const pageSelection = pdfPageSelectionFor(source);
            const text = await extractPdfText(
              document.buffer,
              pageSelection,
            );
            if (!hasEnoughPdfText(text)) {
              return {
                output: null,
                usedPdfVisionFallback: true,
                error: "O PDF não possui texto extraível suficiente e o OCR visual ainda não está disponível neste fluxo.",
              };
            }
            const extraction = await this.extractTextWithRecovery(text, sourceChecklist, source);
            console.info("[ConferIA] Extração concluída", {
              source,
              documentName: document.name,
              durationMs: Date.now() - startedAt,
              extractedTextCharacters: text.length,
              requestedFields: sourceChecklist.length,
              pageSelection,
            });
            return {
              output: extraction.output,
              recoveredFields: extraction.recoveredFields,
              usedPdfVisionFallback: false,
            };
          }
          if (isDocx(document)) {
            const text = await extractDocxText(document.buffer);
            if (!text.trim()) return { output: null, usedPdfVisionFallback: false, error: "O documento Word não possui texto extraível." };
            const extraction = await this.extractTextWithRecovery(text, sourceChecklist, source);
            console.info("[ConferIA] Extração concluída", {
              source,
              documentName: document.name,
              durationMs: Date.now() - startedAt,
              extractedTextCharacters: text.length,
              requestedFields: sourceChecklist.length,
            });
            return { output: extraction.output, recoveredFields: extraction.recoveredFields, usedPdfVisionFallback: false };
          }
          if (document.mimeType.includes("image") || isTiff(document)) {
            const output = await this.extractVisualDocument(document, sourceChecklist);
            console.info("[ConferIA] Extração concluída", {
              source,
              documentName: document.name,
              durationMs: Date.now() - startedAt,
              requestedFields: sourceChecklist.length,
            });
            return {
              output,
              recoveredFields: [],
              usedPdfVisionFallback: false,
            };
          }
          return { output: null, recoveredFields: [], usedPdfVisionFallback: false, error: "Formato de arquivo não suportado." };
        } catch (error) {
          const errorMessage = sanitizeExtractionError(error);
          console.error("[ConferIA] Falha de extração por documento", {
            source,
            documentName: document.name,
            error: errorMessage,
          });
          return { output: null, recoveredFields: [], usedPdfVisionFallback: false, error: errorMessage };
        }
      }),
    );
    const outputs = attempts.flatMap((attempt) => (attempt.output ? [attempt.output] : []));
    const consolidated = consolidateSourceOutputs(source, outputs, checklist);
    const recoveredFields = [...new Set(attempts.flatMap((attempt) => attempt.recoveredFields ?? []))];
    const unreadable = outputs.length === 0;

    return {
      source,
      values: consolidated.values,
      conflictedFields: consolidated.conflictedFields,
      unreadable,
      error: attempts.find((attempt) => attempt.error)?.error,
      usedPdfVisionFallback: attempts.some((attempt) => attempt.usedPdfVisionFallback),
      quality: buildExtractionQuality(source, consolidated.values, checklist, recoveredFields, unreadable),
    };
  }

  private async extractTextWithRecovery(
    text: string,
    checklist: ExtractionRequest["checklist"],
    source: DocumentSource,
  ) {
    const initial = await this.deepSeekProvider.structureText(text, checklist);
    const missing = missingCriticalFields(source, initial, checklist);
    if (!missing.length) return { output: initial, recoveredFields: [] };

    try {
      const recovery = await this.deepSeekProvider.structureText(text, missing);
      const recoveredFields = missing
        .filter((field) => recovery.fields.some((value) => value.fieldId === field.id && value.value != null && String(value.value).trim()))
        .map((field) => field.id);

      console.info("[ConferIA] Recuperação direcionada concluída", {
        source,
        requestedFields: missing.map((field) => field.id),
        recoveredFields,
      });
      return {
        output: mergeRecoveryOutput(initial, recovery, checklist),
        recoveredFields,
      };
    } catch (error) {
      console.warn("[ConferIA] Recuperação direcionada indisponível; extração inicial preservada", {
        source,
        requestedFields: missing.map((field) => field.id),
        error: sanitizeExtractionError(error),
      });
      return { output: initial, recoveredFields: [] };
    }
  }

  private async extractVisualDocument(
    document: UploadedDocumentPayload,
    checklist: ExtractionRequest["checklist"],
  ) {
    if (!isTiff(document)) return this.kimiProvider.extractFromImage(document, checklist);
    const pages = await convertTiffToPngPages(document.buffer);
    const outputs = await Promise.all(
      pages.map((buffer, index) =>
        this.kimiProvider.extractFromImage(
          {
            ...document,
            id: `${document.id}_page_${index + 1}`,
            name: `${document.name} - página ${index + 1}`,
            mimeType: "image/png",
            buffer,
          },
          checklist,
        ).then((output) => ({
          fields: output.fields.map((field) => ({
            ...field,
            sourceLocation: field.sourceLocation
              ? { ...field.sourceLocation, page: index + 1 }
              : field.value
                ? { page: index + 1 }
                : undefined,
          })),
        })),
      ),
    );
    return mergeOutputs(outputs, checklist);
  }
}

function pdfPageSelectionFor(source: DocumentSource) {
  if (source === "MINUTA") return { headPages: 6, tailPages: 2 };
  if (source === "SIOPI") return { headPages: 15, tailPages: 1 };
  if (source === "ITBI") return { headPages: 8, tailPages: 1 };
  return { headPages: 8, tailPages: 2 };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );
  return results;
}

function sanitizeExtractionError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [oculto]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[chave oculta]")
    .slice(0, 500);
}

function isDocx(document: UploadedDocumentPayload) {
  return document.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    document.name.toLowerCase().endsWith(".docx");
}

function isTiff(document: UploadedDocumentPayload) {
  const name = document.name.toLowerCase();
  return document.mimeType === "image/tiff" || name.endsWith(".tif") || name.endsWith(".tiff");
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

function mergeRecoveryOutput(
  initial: ProviderExtractionOutput,
  recovery: ProviderExtractionOutput,
  checklist: ExtractionRequest["checklist"],
): ProviderExtractionOutput {
  return {
    fields: checklist.flatMap((field) => {
      const initialValues = initial.fields.filter((value) => value.fieldId === field.id);
      const hasInitialValue = initialValues.some((value) => value.value != null && String(value.value).trim());
      if (hasInitialValue) return initialValues;
      const recoveredValues = recovery.fields.filter((value) => value.fieldId === field.id);
      return recoveredValues.length ? recoveredValues : initialValues;
    }),
  };
}

function consolidateSourceOutputs(
  source: DocumentSource,
  outputs: ProviderExtractionOutput[],
  checklist: ExtractionRequest["checklist"],
) {
  const conflictedFields: string[] = [];
  const values: ExtractedFieldValue[] = checklist.flatMap((field): ExtractedFieldValue[] => {
    const candidates = outputs
      .flatMap((output) => output.fields)
      .filter((candidate) => candidate.fieldId === field.id && candidate.value != null && String(candidate.value).trim());
    if (field.allowMultiple) {
      const grouped = new Map<string, typeof candidates>();
      for (const candidate of candidates) {
        const participantId = candidate.participantId ?? "buyer_1";
        grouped.set(participantId, [...(grouped.get(participantId) ?? []), candidate]);
      }
      if (!grouped.size) {
        return [{ fieldId: field.id, source, value: null, confidence: 0, sourceLocation: undefined, participantId: undefined }];
      }
      return [...grouped.entries()].map(([participantId, participantCandidates]) => {
        const distinctValues = new Set(
          participantCandidates.map((candidate) => normalizeValue(String(candidate.value), field.fieldType)),
        );
        if (distinctValues.size > 1) conflictedFields.push(`${field.id}::${participantId}`);
        const best = participantCandidates.sort((left, right) => right.confidence - left.confidence)[0];
        return {
          fieldId: field.id,
          participantId,
          source,
          value: best?.value ?? null,
          confidence: best?.confidence ?? 0,
          sourceLocation: best?.sourceLocation,
        };
      });
    }
    const distinctValues = new Set(
      candidates.map((candidate) => normalizeValue(String(candidate.value), field.fieldType)),
    );
    if (distinctValues.size > 1) conflictedFields.push(field.id);
    const best = candidates.sort((left, right) => right.confidence - left.confidence)[0];

    return [{
      fieldId: field.id,
      source,
      value: best?.value ?? null,
      confidence: best?.confidence ?? 0,
      sourceLocation: best?.sourceLocation,
    }];
  });

  return { values, conflictedFields };
}

function alignParticipantIdentities(values: ExtractedFieldValue[]) {
  const participantValues = values.filter((value) => value.participantId);
  const identities = new Map<string, { cpf?: string; name?: string }>();
  for (const value of participantValues) {
    const key = `${value.source}::${value.participantId}`;
    const identity = identities.get(key) ?? {};
    if (value.fieldId === "buyer.cpf" && value.value) identity.cpf = normalizeValue(String(value.value), "cpf");
    if (value.fieldId === "buyer.name" && value.value) identity.name = normalizeValue(String(value.value), "texto");
    identities.set(key, identity);
  }

  const canonicalByName = new Map<string, string>();
  for (const identity of identities.values()) {
    if (identity.cpf && identity.name) canonicalByName.set(identity.name, participantKey(`cpf:${identity.cpf}`));
  }

  return values.map((value) => {
    if (!value.participantId) return value;
    const identity = identities.get(`${value.source}::${value.participantId}`);
    const canonical = identity?.cpf
      ? participantKey(`cpf:${identity.cpf}`)
      : identity?.name && canonicalByName.get(identity.name)
        ? canonicalByName.get(identity.name)
        : identity?.name
          ? participantKey(`name:${identity.name}`)
          : `${value.source.toLowerCase()}_${value.participantId}`;
    return { ...value, participantId: canonical };
  });
}

function participantKey(identity: string) {
  return `participant_${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
}
