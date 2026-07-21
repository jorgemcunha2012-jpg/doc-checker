import { getChecklist } from "@/domain/checklists";
import { createHash } from "node:crypto";
import type { DocumentSource, ExtractedFieldValue, ProviderExtractionOutput } from "@/domain/validation";
import { normalizeValue } from "@/services/normalization/normalization-service";
import { DeepSeekProvider } from "./deepseek-provider";
import { KimiProvider } from "./kimi-provider";
import { extractPdfText, hasEnoughPdfText } from "./pdf-text-service";
import { extractPdfOcrText } from "./pdf-ocr-service";
import { extractImageOcrText } from "./image-ocr-service";
import { extractDocxText, extractRtfText } from "./word-text-service";
import { extractXlsxText, isXlsxName } from "./xlsx-text-service";
import { enrichReservationFinancialComposition } from "./reservation-financial-composition";
import { convertTiffToPngPages } from "./tiff-image-service";
import type { ExtractionRequest, ExtractionResult, ReconciliationExtractionResult, UploadedDocumentPayload } from "./types";
import { buildExtractionQuality, missingCriticalFields, validateCriticalEvidence } from "./extraction-quality-service";
import { extractDeterministicFields } from "./deterministic-field-extractor";

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
      } else if (isDocx(document) || isRtf(document) || isXlsx(document)) {
        const text = await extractTextDocument(document);
        outputs.push(await this.deepSeekProvider.structureText(text, checklist));
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
              console.info("[ConferIA] PDF sem texto extraível suficiente; iniciando OCR", {
                source,
                documentName: document.name,
                extractedTextCharacters: text.length,
                pageSelection,
              });
              const ocrText = await extractPdfOcrText(document.buffer, { maxPages: pdfOcrPageLimitFor(source) });
              if (!hasEnoughPdfText(ocrText)) {
                return {
                  output: null,
                  recoveredFields: [],
                  deterministicFields: [],
                  usedPdfVisionFallback: true,
                  extractionMethod: "OCR" as const,
                  error: "PDF escaneado/imagem sem texto legível suficiente após OCR. Possíveis causas: baixa resolução, imagem torta, borrada, texto muito pequeno ou páginas sem os dados esperados.",
                };
              }
              const extraction = await this.extractTextWithRecovery(ocrText, sourceChecklist, source);
              console.info("[ConferIA] Extração OCR concluída", {
                source,
                documentName: document.name,
                durationMs: Date.now() - startedAt,
                extractedTextCharacters: ocrText.length,
                requestedFields: sourceChecklist.length,
                pageSelection,
              });
              return {
                output: extraction.output,
                recoveredFields: extraction.recoveredFields,
                deterministicFields: extraction.deterministicFields,
                usedPdfVisionFallback: true,
                extractionMethod: "OCR" as const,
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
              deterministicFields: extraction.deterministicFields,
              usedPdfVisionFallback: false,
              extractionMethod: "TEXT" as const,
            };
          }
          if (isDocx(document) || isRtf(document) || isXlsx(document)) {
            const text = await extractTextDocument(document);
            if (!text.trim()) return { output: null, usedPdfVisionFallback: false, error: "O documento Word, RTF ou XLSX não possui texto extraível." };
            const extraction = await this.extractTextWithRecovery(text, sourceChecklist, source);
            console.info("[ConferIA] Extração concluída", {
              source,
              documentName: document.name,
              durationMs: Date.now() - startedAt,
              extractedTextCharacters: text.length,
              requestedFields: sourceChecklist.length,
            });
            return {
              output: extraction.output,
              recoveredFields: extraction.recoveredFields,
              deterministicFields: extraction.deterministicFields,
              usedPdfVisionFallback: false,
              extractionMethod: "TEXT" as const,
            };
          }
          if (document.mimeType.includes("image") || isTiff(document)) {
            const output = await this.extractVisualDocument(document, sourceChecklist, source);
            const deterministicFields = source === "DADOS_RESERVA"
              ? output.fields
                .filter((field) => field.value && ["Print de pagamento", "Composição calculada do print"].includes(field.sourceLocation?.section ?? ""))
                .map((field) => field.fieldId)
              : [];
            console.info("[ConferIA] Extração concluída", {
              source,
              documentName: document.name,
              durationMs: Date.now() - startedAt,
              requestedFields: sourceChecklist.length,
              deterministicFields,
            });
            return {
              output,
              recoveredFields: [],
              deterministicFields,
              usedPdfVisionFallback: false,
              extractionMethod: deterministicFields.length ? "MIXED" as const : "VISION" as const,
            };
          }
          return { output: null, recoveredFields: [], deterministicFields: [], usedPdfVisionFallback: false, extractionMethod: "UNSUPPORTED" as const, error: `Formato de arquivo não suportado: ${document.mimeType || document.name}.` };
        } catch (error) {
          const errorMessage = sanitizeExtractionError(error);
          console.error("[ConferIA] Falha de extração por documento", {
            source,
            documentName: document.name,
            error: errorMessage,
          });
          return { output: null, recoveredFields: [], deterministicFields: [], usedPdfVisionFallback: false, error: explainExtractionError(errorMessage, document) };
        }
      }),
    );
    const outputs = attempts.flatMap((attempt) => (attempt.output ? [attempt.output] : []));
    const consolidated = consolidateSourceOutputs(source, outputs, checklist);
    const recoveredFields = [...new Set(attempts.flatMap((attempt) => attempt.recoveredFields ?? []))];
    const deterministicFields = [...new Set(attempts.flatMap((attempt) => attempt.deterministicFields ?? []))];
    const unreadable = outputs.length === 0;
    const error = attempts.find((attempt) => attempt.error)?.error;
    const extractionMethods = [...new Set(attempts.map((attempt) => attempt.extractionMethod).filter(Boolean))];

    return {
      source,
      values: consolidated.values,
      conflictedFields: consolidated.conflictedFields,
      unreadable,
      error,
      usedPdfVisionFallback: attempts.some((attempt) => attempt.usedPdfVisionFallback),
      quality: buildExtractionQuality(
        source,
        consolidated.values,
        checklist,
        recoveredFields,
        deterministicFields,
        consolidated.conflictedFields,
        unreadable,
        {
          error,
          extractionMethod: extractionMethods.length > 1 ? "MIXED" : extractionMethods[0],
          evidenceIssues: consolidated.evidenceIssues,
        },
      ),
    };
  }

  private async extractTextWithRecovery(
    text: string,
    checklist: ExtractionRequest["checklist"],
    source: DocumentSource,
  ) {
    const deterministic = extractDeterministicFields(text, checklist, source);
    const deterministicFields = deterministic.fields
      .filter((field) => field.value != null && String(field.value).trim())
      .map((field) => field.fieldId);
    let providerOutput: ProviderExtractionOutput = { fields: [] };
    let providerFailed = false;
    try {
      providerOutput = await this.deepSeekProvider.structureText(text, checklist);
    } catch (error) {
      providerFailed = true;
      console.warn("[ConferIA] Provider textual indisponível; preservando extração determinística", {
        source,
        error: sanitizeExtractionError(error),
        deterministicFields,
      });
    }
    const initial = mergeRecoveryOutput(providerOutput, deterministic, checklist, true);
    const missing = missingCriticalFields(source, initial, checklist);
    if (!missing.length || providerFailed) return { output: initial, recoveredFields: [], deterministicFields };

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
        output: mergeRecoveryOutput(mergeRecoveryOutput(initial, recovery, checklist), deterministic, checklist, true),
        recoveredFields,
        deterministicFields,
      };
    } catch (error) {
      console.warn("[ConferIA] Recuperação direcionada indisponível; extração inicial preservada", {
        source,
        requestedFields: missing.map((field) => field.id),
        error: sanitizeExtractionError(error),
      });
      return { output: initial, recoveredFields: [], deterministicFields };
    }
  }

  private async extractVisualDocument(
    document: UploadedDocumentPayload,
    checklist: ExtractionRequest["checklist"],
    source?: DocumentSource,
  ) {
    if (!isTiff(document)) return this.extractSingleVisualDocument(document, checklist, source);
    const pages = await convertTiffToPngPages(document.buffer);
    const outputs = await Promise.all(
      pages.map((buffer, index) =>
        this.extractSingleVisualDocument(
          {
            ...document,
            id: `${document.id}_page_${index + 1}`,
            name: `${document.name} - página ${index + 1}`,
            mimeType: "image/png",
            buffer,
          },
          checklist,
          source,
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

  private async extractSingleVisualDocument(
    document: UploadedDocumentPayload,
    checklist: ExtractionRequest["checklist"],
    source?: DocumentSource,
  ) {
    if (source !== "DADOS_RESERVA") return this.kimiProvider.extractFromImage(document, checklist);

    const localOcrPromise = process.env.CONFERIA_SKIP_LOCAL_OCR === "true"
      ? Promise.reject(new Error("OCR local desabilitado para esta execução."))
      : extractImageOcrText(document.buffer);
    const [focusedAttempt, ocrAttempt, localOcrAttempt] = await Promise.allSettled([
      this.kimiProvider.extractReservationFromImage(document, checklist),
      this.kimiProvider.transcribeReservationImage(document).then((text) => ({
        output: extractDeterministicFields(text, checklist, "DADOS_RESERVA"),
        text,
      })),
      localOcrPromise.then((text) => ({
        output: extractDeterministicFields(text, checklist, "DADOS_RESERVA"),
        text,
      })),
    ]);
    const focusedOutput = focusedAttempt.status === "fulfilled" ? focusedAttempt.value : null;
    const ocrOutput = ocrAttempt.status === "fulfilled" ? ocrAttempt.value.output : null;
    const localOcrOutput = localOcrAttempt.status === "fulfilled" ? localOcrAttempt.value.output : null;
    const ocrText = [
      ocrAttempt.status === "fulfilled" ? ocrAttempt.value.text : "",
      localOcrAttempt.status === "fulfilled" ? localOcrAttempt.value.text : "",
    ].filter(Boolean).join("\n");
    const focusedPaymentIsComplete = hasReliableReservationFinancialEvidence(focusedOutput, ["financial.totalValue", "financial.financing"]);
    const financialAttempt = hasReservationPaymentTable(ocrText) && !focusedPaymentIsComplete
      ? await this.kimiProvider.extractReservationFinancialComponentsFromImage(document, checklist).catch((error) => {
        console.warn("[ConferIA] Leitura especializada da condição de pagamento falhou", {
          documentName: document.name,
          error: sanitizeExtractionError(error),
        });
        return null;
      })
      : null;
    const focusedPreRegistrationIsComplete = hasReliableReservationFinancialEvidence(focusedOutput, ["financial.totalValue"]);
    const preRegistrationAttempt = hasReservationPreRegistrationSummary(ocrText) && !focusedPreRegistrationIsComplete
      ? await this.kimiProvider.extractReservationPreRegistrationFinancials(document, checklist).catch((error) => {
        console.warn("[ConferIA] Leitura especializada do pré-cadastro falhou", {
          documentName: document.name,
          error: sanitizeExtractionError(error),
        });
        return null;
      })
      : null;
    const firstPassOutputs = sanitizeReservationOutputs(
      [focusedOutput, ocrOutput, localOcrOutput, financialAttempt, preRegistrationAttempt]
        .filter((output): output is ProviderExtractionOutput => Boolean(output)),
      checklist,
    );
    let merged = enrichReservationFinancialComposition(mergeReservationOutputs(firstPassOutputs, checklist), checklist, ocrText);
    const recoveryTargets = reservationRecoveryTargets(merged, ocrText);
    if (!recoveryTargets.length) {
        if (ocrOutput || localOcrOutput) {
          console.info("[ConferIA] Dados da Reserva extraídos com camadas OCR determinísticas", {
            documentName: document.name,
            extractedTextCharacters: ocrAttempt.status === "fulfilled" ? ocrAttempt.value.text.length : 0,
            localOcrTextCharacters: localOcrAttempt.status === "fulfilled" ? localOcrAttempt.value.text.length : 0,
          });
        }
        return merged;
    }

    const targetedAttempts = await Promise.all([
      recoveryTargets.includes("identity")
        ? this.kimiProvider.extractReservationIdentityFromImage(document, checklist).catch((error) => {
          console.warn("[ConferIA] Revisão dirigida de dados pessoais falhou", { documentName: document.name, error: sanitizeExtractionError(error) });
          return null;
        })
        : Promise.resolve(null),
      recoveryTargets.includes("unit")
        ? this.kimiProvider.extractReservationUnitFromImage(document, checklist).catch((error) => {
          console.warn("[ConferIA] Revisão dirigida da unidade falhou", { documentName: document.name, error: sanitizeExtractionError(error) });
          return null;
        })
        : Promise.resolve(null),
      recoveryTargets.includes("payment") && !financialAttempt
        ? this.kimiProvider.extractReservationFinancialComponentsFromImage(document, checklist).catch((error) => {
          console.warn("[ConferIA] Revisão dirigida financeira falhou", { documentName: document.name, error: sanitizeExtractionError(error) });
          return null;
        })
        : Promise.resolve(null),
    ]);
    const targetedOutputs = sanitizeReservationOutputs(targetedAttempts.filter((output): output is ProviderExtractionOutput => Boolean(output)), checklist);
    merged = enrichReservationFinancialComposition(mergeReservationOutputs([...firstPassOutputs, ...targetedOutputs], checklist), checklist, ocrText);
    if (!reservationRecoveryTargets(merged, ocrText).length) return merged;

    if (focusedAttempt.status === "rejected") {
      console.warn("[ConferIA] Extração focada de Dados da Reserva falhou", {
        documentName: document.name,
        error: sanitizeExtractionError(focusedAttempt.reason),
      });
    }
    if (ocrAttempt.status === "rejected") {
      console.warn("[ConferIA] OCR textual de Dados da Reserva falhou", {
        documentName: document.name,
        error: sanitizeExtractionError(ocrAttempt.reason),
      });
    }
    if (localOcrAttempt.status === "rejected") {
      console.warn("[ConferIA] OCR local de Dados da Reserva falhou", {
        documentName: document.name,
        error: sanitizeExtractionError(localOcrAttempt.reason),
      });
    }

    try {
      const genericOutput = await this.kimiProvider.extractFromImage(document, checklist);
      merged = enrichReservationFinancialComposition(mergeReservationOutputs([...firstPassOutputs, ...targetedOutputs, ...sanitizeReservationOutputs([genericOutput], checklist)], checklist), checklist, ocrText);
      if (!reservationRecoveryTargets(merged, ocrText).length) {
        console.info("[ConferIA] Dados da Reserva recuperados com extração visual genérica", {
          documentName: document.name,
        });
      }
      return merged;
    } catch (error) {
      console.warn("[ConferIA] Todas as camadas visuais de Dados da Reserva falharam", {
        documentName: document.name,
        error: sanitizeExtractionError(error),
      });
      return firstPassOutputs.length ? merged : emptyOutput(checklist);
    }
  }
}

function reservationRecoveryTargets(output: ProviderExtractionOutput, ocrText: string) {
  const available = new Set(
    output.fields
      .filter((field) => field.value != null && String(field.value).trim())
      .map((field) => field.fieldId),
  );
  const groups = {
    identity: ["buyer.name", "buyer.cpf", "buyer.rg", "buyer.maritalStatus", "buyer.address", "buyer.email", "buyer.phone"],
    unit: ["property.development", "property.registration", "property.unit", "property.tower"],
    payment: ["financial.totalValue", "financial.financing"],
  } as const;
  const text = ocrText.toLowerCase();
  const selected = new Set<keyof typeof groups>();
  if (/nome\s+do\s+cliente|cpf\s*\/?\s*cnpj|estado\s+civil|e-?mail|telefone|celular/.test(text)) selected.add("identity");
  if (hasReservationPaymentTable(text)) selected.add("payment");
  if (/\bunidade\b|\btorre\b|matr[ií]cula/.test(text)) selected.add("unit");
  if (!selected.size) {
    if ([...groups.identity].some((field) => available.has(field))) selected.add("identity");
    if ([...groups.payment].some((field) => available.has(field))) selected.add("payment");
    if ([...groups.unit].some((field) => available.has(field))) selected.add("unit");
  }
  if (!selected.size) return ["identity", "unit", "payment"] as Array<keyof typeof groups>;
  return [...selected].filter((group) => groups[group].some((field) => !available.has(field)));
}

function sanitizeReservationOutputs(outputs: ProviderExtractionOutput[], checklist: ExtractionRequest["checklist"]) {
  return outputs.map((output) => validateCriticalEvidence("DADOS_RESERVA", output, checklist).output);
}

function hasReservationPaymentTable(text: string) {
  return /condi[cç][aã]o\s+de\s+pagamento|valor\s+do\s+contrato|\bfinanciamento\b|\bsinal\b|\bmensal\b/i.test(text);
}

function hasReservationPreRegistrationSummary(text: string) {
  return /valor\s+avalia[cç][aã]o|valor\s+aprovado|valor\s+subs[ií]dio|valor\s*fgts/i.test(text);
}

function hasReliableReservationFinancialEvidence(output: ProviderExtractionOutput | null, fieldIds: string[]) {
  if (!output) return false;
  return fieldIds.every((fieldId) => {
    const field = output.fields.find((candidate) => candidate.fieldId === fieldId);
    return Boolean(field?.value && field.confidence >= 85 && field.sourceLocation?.rawText);
  });
}

function pdfPageSelectionFor(source: DocumentSource) {
  if (source === "MINUTA") return { headPages: 6, tailPages: 2 };
  if (source === "SIOPI") return { headPages: 15, tailPages: 1 };
  if (source === "ITBI") return { headPages: 8, tailPages: 1 };
  return { headPages: 8, tailPages: 2 };
}

function pdfOcrPageLimitFor(source: DocumentSource) {
  if (source === "MINUTA") return 8;
  if (source === "SIOPI") return 12;
  if (source === "ITBI") return 8;
  return 10;
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

function explainExtractionError(message: string, document: UploadedDocumentPayload) {
  const lower = message.toLowerCase();
  if (lower.includes("password") || lower.includes("encrypted") || lower.includes("senha")) {
    return `PDF protegido por senha ou criptografia: ${document.name}. Remova a proteção ou envie uma versão desbloqueada.`;
  }
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return `Tempo excedido ao extrair ${document.name}. O arquivo pode ser muito pesado, escaneado em alta resolução ou o provedor de IA/OCR demorou demais.`;
  }
  if (lower.includes("invalid pdf") || lower.includes("corrupt") || lower.includes("bad xref")) {
    return `PDF corrompido ou malformado: ${document.name}. Gere uma nova cópia do documento e tente novamente.`;
  }
  if (lower.includes("não configurado") || lower.includes("api key")) {
    return `Provider de extração não configurado corretamente para ${document.name}. Verifique as variáveis de ambiente da IA/OCR.`;
  }
  return message;
}

function isDocx(document: UploadedDocumentPayload) {
  return document.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    document.name.toLowerCase().endsWith(".docx");
}

function isRtf(document: UploadedDocumentPayload) {
  return document.mimeType === "application/rtf" || document.mimeType === "text/rtf" || document.name.toLowerCase().endsWith(".rtf");
}

function isXlsx(document: UploadedDocumentPayload) {
  return document.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || isXlsxName(document.name);
}

async function extractTextDocument(document: UploadedDocumentPayload) {
  if (isRtf(document)) return extractRtfText(document.buffer);
  if (isXlsx(document)) return extractXlsxText(document.buffer);
  return extractDocxText(document.buffer);
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

function mergeReservationOutputs(outputs: ProviderExtractionOutput[], checklist: ExtractionRequest["checklist"]): ProviderExtractionOutput {
  return {
    fields: checklist.map((field) => {
      const candidates = outputs
        .flatMap((output) => output.fields)
        .filter((candidate) => candidate.fieldId === field.id && candidate.value != null && String(candidate.value).trim());
      const best = candidates.sort((left, right) => reservationCandidateScore(right, field.id) - reservationCandidateScore(left, field.id))[0];
      return best ?? { fieldId: field.id, value: null, confidence: 0 };
    }),
  };
}

function reservationCandidateScore(candidate: ProviderExtractionOutput["fields"][number], fieldId: string) {
  const rawText = candidate.sourceLocation?.rawText ?? "";
  let score = candidate.confidence;
  if (rawText) score += 15;
  if (String(candidate.value).replace(/\D/g, "") && rawText.replace(/\D/g, "").includes(String(candidate.value).replace(/\D/g, ""))) score += 20;
  if (!fieldId.startsWith("financial.")) return score;

  const label = fieldId === "financial.totalValue"
    ? /valor\s+(?:do\s+contrato|total)/i
    : fieldId === "financial.financing"
      ? /financiamento|valor\s+financiado/i
      : fieldId === "financial.fgts"
        ? /fgts/i
        : fieldId === "financial.subsidy"
          ? /subs[ií]dio|desconto/i
          : /entrada|recursos\s+pr[oó]prios/i;
  return score + (label.test(rawText) ? 40 : -40);
}

function mergeRecoveryOutput(
  initial: ProviderExtractionOutput,
  recovery: ProviderExtractionOutput,
  checklist: ExtractionRequest["checklist"],
  preferRecovery = false,
): ProviderExtractionOutput {
  return {
    fields: checklist.flatMap((field) => {
      const initialValues = initial.fields.filter((value) => value.fieldId === field.id);
      const recoveredValues = recovery.fields.filter((value) => value.fieldId === field.id);
      const hasRecoveredValue = recoveredValues.some((value) => value.value != null && String(value.value).trim());
      if (preferRecovery && hasRecoveredValue) return recoveredValues;
      const hasInitialValue = initialValues.some((value) => value.value != null && String(value.value).trim());
      if (hasInitialValue) return initialValues;
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
  const evidenceIssues: string[] = [];
  const validatedOutputs = outputs.map((output) => {
    const validated = validateCriticalEvidence(source, output, checklist);
    evidenceIssues.push(...validated.evidenceIssues);
    return validated.output;
  });
  const values: ExtractedFieldValue[] = checklist.flatMap((field): ExtractedFieldValue[] => {
    const candidates = validatedOutputs
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

  return { values, conflictedFields, evidenceIssues: [...new Set(evidenceIssues)] };
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
