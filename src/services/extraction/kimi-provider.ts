import type { DevelopmentExtraction } from "@/domain/development";
import type { ChecklistField, ProviderExtractionOutput } from "@/domain/validation";
import type { DocumentExtractionProvider, UploadedDocumentPayload } from "./types";
import { OpenAICompatibleClient } from "./openai-compatible-client";
import { checklistPrompt, coerceExtractionOutput } from "./provider-utils";

export class KimiProvider implements DocumentExtractionProvider {
  provider = "KIMI" as const;

  private readonly client = new OpenAICompatibleClient({
    apiKey: process.env.KIMI_API_KEY,
    baseUrl: process.env.KIMI_API_BASE_URL,
    model: process.env.KIMI_MODEL,
    providerName: "Kimi",
  });

  async extractFromImage(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const dataUrl = `data:${document.mimeType};base64,${document.buffer.toString("base64")}`;
    const result = await this.client.completeJson([
      {
        role: "system",
        content:
          "Você extrai dados documentais imobiliários de imagens. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. rawText deve conter somente o pequeno trecho que evidencia o valor, nunca a página inteira. Campos ausentes devem retornar value null, confidence 0 e sourceLocation omitido.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extraia semanticamente os campos abaixo da imagem, sem assumir layout fixo.\n${checklistPrompt(checklist)}`,
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ], { timeoutMs: 120_000 });

    return coerceExtractionOutput(result, checklist);
  }

  async extractFromPdfFallback(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const dataUrl = `data:${document.mimeType};base64,${document.buffer.toString("base64")}`;
    const result = await this.client.completeJson([
      {
        role: "system",
        content:
          "Você extrai dados de PDFs escaneados recebidos como arquivo visual/base64. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. rawText deve ser um trecho curto de evidência.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `O PDF não possui texto suficiente por parsing direto. Extraia os campos esperados.\n${checklistPrompt(checklist)}`,
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ]);

    return coerceExtractionOutput(result, checklist);
  }

  async extractDevelopment(images: string[]): Promise<DevelopmentExtraction> {
    const attempts = await Promise.allSettled(images.map((image, index) => this.extractDevelopmentPage(image, index + 1)));
    const pages = attempts.flatMap((attempt) => attempt.status === "fulfilled" ? [attempt.value] : []);
    if (!pages.length) {
      const failure = attempts.find((attempt) => attempt.status === "rejected");
      throw failure?.status === "rejected" ? failure.reason : new Error("Nenhuma página pôde ser interpretada.");
    }
    const firstNamed = pages.find((page) => page.name !== "Empreendimento sem nome");
    const units = new Map<string, DevelopmentExtraction["units"][number]>();
    pages.flatMap((page) => page.units).forEach((unit) => {
      const key = `${unit.tower.toUpperCase()}::${unit.unit.toUpperCase()}`;
      const current = units.get(key);
      if (!current || unit.confidence > current.confidence) units.set(key, unit);
    });
    return {
      name: firstNamed?.name ?? "Empreendimento sem nome",
      city: pages.find((page) => page.city)?.city,
      registration: pages.find((page) => page.registration)?.registration,
      units: [...units.values()],
    };
  }

  private async extractDevelopmentPage(image: string, page: number) {
    const result = await this.client.completeJson([
      {
        role: "system",
        content:
          "Você estrutura cadastros mestres de empreendimentos imobiliários a partir de matrículas e memoriais. Responda somente JSON válido. Não invente unidades. Preserve números e casas decimais exatamente como aparecem.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Esta é a página ${page}. Extraia o empreendimento e todas as regras explícitas e legíveis de torre, apartamento e área privativa nesta página. Responda no formato compacto {\"name\":string|null,\"city\":string|null,\"registration\":string|null,\"groups\":[{\"towers\":[string],\"units\":[string],\"privateArea\":string,\"typology\":string|null,\"registration\":string|null,\"confidence\":number}]}. Não expanda combinações. Ignore regras cortadas ou incompletas nas margens.`,
          },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ], { timeoutMs: 240_000, maxTokens: 3_000 });
    return coerceDevelopmentExtraction(result);
  }
}

function coerceDevelopmentExtraction(value: unknown): DevelopmentExtraction {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawGroups = Array.isArray(data.groups) ? data.groups : [];
  const units = rawGroups.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const group = item as Record<string, unknown>;
    const towers = stringArray(group.towers);
    const apartments = stringArray(group.units);
    const privateArea = clean(group.privateArea);
    if (!towers.length || !apartments.length || !privateArea) return [];
    return towers.flatMap((tower) => apartments.map((unit) => ({
      tower,
      unit,
      privateArea,
      typology: clean(group.typology) || undefined,
      registration: clean(group.registration) || undefined,
      confidence: Math.max(0, Math.min(100, Number(group.confidence) || 0)),
    })));
  });

  return {
    name: clean(data.name) || "Empreendimento sem nome",
    city: clean(data.city) || undefined,
    registration: clean(data.registration) || undefined,
    units,
  };
}

function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}
