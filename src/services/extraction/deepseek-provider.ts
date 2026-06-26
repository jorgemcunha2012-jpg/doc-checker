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
          "Você estrutura texto bruto de documentos imobiliários. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. rawText deve ser apenas o pequeno trecho que sustenta o valor. Não compare campos.",
      },
      {
        role: "user",
        content: `Texto bruto:\n${compactDocumentText(text)}\n\nCampos esperados:\n${checklistPrompt(checklist)}`,
      },
    ], { timeoutMs: 75_000 });

    return coerceExtractionOutput(result, checklist);
  }
}

function compactDocumentText(text: string) {
  const maximumCharacters = 12_000;
  if (text.length <= maximumCharacters) {
    return text;
  }

  const headSize = 9_500;
  const tailSize = maximumCharacters - headSize;
  return `${text.slice(0, headSize)}\n\n[CONTEÚDO INTERMEDIÁRIO OMITIDO]\n\n${text.slice(-tailSize)}`;
}
