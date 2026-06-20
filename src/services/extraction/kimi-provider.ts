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
          "Você extrai dados documentais imobiliários de imagens. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"value\":string|null,\"confidence\":number}]}. Campos ausentes devem retornar value null e confidence 0.",
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
    ]);

    return coerceExtractionOutput(result, checklist);
  }

}
