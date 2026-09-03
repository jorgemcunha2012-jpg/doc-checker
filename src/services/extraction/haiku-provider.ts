import type { ChecklistField, ProviderExtractionOutput } from "@/domain/validation";
import type { DocumentExtractionProvider } from "./types";
import { enrichStandardFinancialFields, focusDocumentText } from "./deepseek-provider";
import { checklistPrompt, coerceExtractionOutput } from "./provider-utils";

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

export class HaikuProvider implements DocumentExtractionProvider {
  provider = "HAIKU" as const;

  async structureText(text: string, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const focusedText = focusDocumentText(text, checklist);
    const content = await this.request(focusedText, checklist);
    return enrichStandardFinancialFields(coerceExtractionOutput(parseJson(content), checklist), text, checklist);
  }

  private async request(text: string, checklist: ChecklistField[]) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
    if (!apiKey) throw new Error("Haiku não configurado. Confira ANTHROPIC_API_KEY no .env.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2_400,
          system: "Você estrutura texto bruto de documentos imobiliários. Identifique todos os compradores/adquirentes separadamente. Para campos repetíveis, retorne uma entrada por pessoa e use participantId buyer_1, buyer_2 etc. de forma consistente em todos os campos da mesma pessoa. Diferencie rigorosamente endereço residencial, endereço do imóvel e endereço do vendedor. Se não houver evidência suficiente, retorne null e confiança 0. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"participantId\":string|null,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. rawText deve conter somente o pequeno trecho que sustenta o valor. Não compare campos.",
          messages: [{ role: "user", content: `Texto bruto:\n${text}\n\nCampos esperados:\n${checklistPrompt(checklist)}` }],
        }),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`Haiku retornou ${response.status}: ${body}`);
      const parsed = JSON.parse(body) as AnthropicResponse;
      const content = parsed.content?.find((item) => item.type === "text")?.text;
      if (!content) throw new Error("Haiku não retornou conteúdo estruturado.");
      return content;
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Haiku excedeu o tempo limite de 60 segundos.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseJson(content: string) {
  const value = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(value) as unknown;
}
