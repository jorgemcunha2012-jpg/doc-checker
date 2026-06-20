import type { ChecklistField, ProviderExtractionOutput } from "@/domain/validation";
import type { DocumentExtractionProvider } from "./types";
import { OpenAICompatibleClient } from "./openai-compatible-client";
import { checklistPrompt, coerceExtractionOutput } from "./provider-utils";

export class DeepSeekProvider implements DocumentExtractionProvider {
  provider = "DEEPSEEK" as const;

  private readonly client = new OpenAICompatibleClient({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_API_BASE_URL,
    model: process.env.DEEPSEEK_MODEL,
    providerName: "DeepSeek",
  });

  async structureText(text: string, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const result = await this.client.completeJson([
      {
        role: "system",
        content:
          "Você estrutura texto bruto de documentos imobiliários. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"value\":string|null,\"confidence\":number}]}. Não compare campos.",
      },
      {
        role: "user",
        content: `Texto bruto:\n${text.slice(0, 120000)}\n\nCampos esperados:\n${checklistPrompt(checklist)}`,
      },
    ]);

    return coerceExtractionOutput(result, checklist);
  }
}
