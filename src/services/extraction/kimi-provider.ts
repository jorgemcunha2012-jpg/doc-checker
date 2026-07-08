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
          "Você extrai dados documentais imobiliários de imagens. Identifique todos os compradores/adquirentes separadamente. Para campos repetíveis, retorne uma entrada por pessoa e use participantId buyer_1, buyer_2 etc. de forma consistente em todos os campos da mesma pessoa. Diferencie rigorosamente o endereço residencial das partes do endereço do imóvel. Se não for possível identificar a quem o endereço pertence, retorne null e confiança 0. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"participantId\":string|null,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. rawText deve conter somente o pequeno trecho que evidencia o valor, nunca a página inteira. Campos ausentes devem retornar value null, confidence 0 e sourceLocation omitido.",
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

  async extractReservationFromImage(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const dataUrl = `data:${document.mimeType};base64,${document.buffer.toString("base64")}`;
    const reservationChecklist = checklist.filter((field) => reservationFieldIds.has(field.id));
    const result = await this.client.completeJson([
      {
        role: "system",
        content:
          "Você extrai dados das telas de reserva imobiliária. A imagem pode ser uma tela de dados do cliente, uma tela de condição de pagamento, ou ambas. Nunca ignore um campo crítico visível. Leia rótulos e valores mesmo quando o valor estiver na linha abaixo do rótulo. Diferencie endereço do cliente de endereço do imóvel. Retorne somente campos encontrados; omita campos ausentes. Use confidence como inteiro de 0 a 100. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"participantId\":string|null,\"value\":string,\"confidence\":number,\"sourceLocation\":{\"section\":string|null,\"rawText\":string|null}}]}. rawText deve conter somente o pequeno trecho que evidencia o valor.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Extraia apenas os dados visíveis nesta imagem de Dados da Reserva.\n\n` +
              "Mapeamento obrigatório quando aparecer:\n" +
              "- NOME DO CLIENTE ou Cliente -> buyer.name\n" +
              "- CPF/CNPJ -> buyer.cpf quando for CPF de pessoa física\n" +
              "- RG -> buyer.rg\n" +
              "- CELULAR ou TELEFONE -> buyer.phone\n" +
              "- E-MAIL -> buyer.email\n" +
              "- ESTADO CIVIL -> buyer.maritalStatus\n" +
              "- ENDEREÇO, NÚMERO, COMPLEMENTO, BAIRRO, CIDADE, ESTADO -> buyer.address consolidado\n" +
              "- Unidade no formato EMPREENDIMENTO / TORRE X / APTO ou Unidade -> property.development, property.tower, property.unit e property.registration quando houver Matrícula\n" +
              "- Valor do contrato -> financial.totalValue\n" +
              "- linha Financiamento -> financial.financing\n" +
              "- linha FGTS -> financial.fgts somente se houver FGTS explícito\n" +
              "- linha Subsídio/Subsidio/Desconto -> financial.subsidy somente se houver explícito\n" +
              "- Sinal/Entrada/Recursos próprios -> financial.downPayment quando for claramente entrada.\n\n" +
              "Não retorne campos com value null. Não escreva explicações fora do JSON.\n\n" +
              "Campos esperados:\n" +
              checklistPrompt(reservationChecklist),
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ], { timeoutMs: 120_000, maxTokens: 4_000, responseFormat: false });

    const focusedOutput = coerceExtractionOutput(result, reservationChecklist);
    const fieldsById = new Map(focusedOutput.fields.map((field) => [field.fieldId, field]));
    return {
      fields: checklist.map((field) => fieldsById.get(field.id) ?? {
        fieldId: field.id,
        value: null,
        confidence: 0,
      }),
    };
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
              `Esta é a página ${page}. Extraia o empreendimento e todas as regras explícitas e legíveis de torre, apartamento, área privativa, área total e fração ideal nesta página. Responda no formato compacto {\"name\":string|null,\"city\":string|null,\"registration\":string|null,\"groups\":[{\"towers\":[string],\"units\":[string],\"privateArea\":string,\"totalArea\":string|null,\"idealFraction\":string|null,\"typology\":string|null,\"registration\":string|null,\"confidence\":number}]}. Não expanda combinações inventadas. Ignore regras cortadas ou incompletas nas margens.`,
          },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ], { timeoutMs: 240_000, maxTokens: 3_000 });
    return coerceDevelopmentExtraction(result);
  }
}

const reservationFieldIds = new Set([
  "buyer.name",
  "buyer.cpf",
  "buyer.rg",
  "buyer.maritalStatus",
  "buyer.address",
  "buyer.email",
  "buyer.phone",
  "property.development",
  "property.registration",
  "property.unit",
  "property.tower",
  "financial.totalValue",
  "financial.downPayment",
  "financial.financing",
  "financial.fgts",
  "financial.subsidy",
]);

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
      totalArea: clean(group.totalArea) || undefined,
      idealFraction: clean(group.idealFraction) || undefined,
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
