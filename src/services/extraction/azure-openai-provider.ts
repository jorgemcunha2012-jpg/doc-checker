import type { ChecklistField, ExtractionProvider, ProviderExtractionOutput } from "@/domain/validation";
import type { ChatMessage, ProviderLanguageClient } from "./openai-compatible-client";
import { parseJsonResponse } from "./openai-compatible-client";
import { fetchProvider } from "./provider-gateway";
import { KimiProvider } from "./kimi-provider";
import { checklistPrompt, coerceExtractionOutput } from "./provider-utils";
import { enrichStandardFinancialFields, focusDocumentText } from "./deepseek-provider";
import { restoreTokenizedOutput, tokenizeSensitiveText } from "./pii-tokenizer";

/**
 * Azure OpenAI speaks the same chat format used by the existing visual provider.
 * Reusing Kimi's extraction instructions keeps this pilot isolated from the
 * deterministic extraction and reconciliation layers.
 */
class AzureOpenAIClient implements ProviderLanguageClient {
  async completeText(messages: ChatMessage[], options: { timeoutMs?: number; maxTokens?: number } = {}) {
    const payload = await this.request(messages, options);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Azure OpenAI não retornou texto.");
    return content.trim();
  }

  async completeJson(messages: ChatMessage[], options: { timeoutMs?: number; maxTokens?: number; responseFormat?: boolean } = {}) {
    const payload = await this.request(messages, options);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Azure OpenAI não retornou conteúdo estruturado.");
    return parseJsonResponse(content);
  }

  private async request(messages: ChatMessage[], options: { timeoutMs?: number; maxTokens?: number; responseFormat?: boolean }) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
    if (!apiKey || !endpoint || !deployment) {
      throw new Error("Azure OpenAI não configurado. Confira endpoint, deployment e API key no ambiente do servidor.");
    }

    const timeoutMs = options.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
      const response = await fetchProvider(url, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          temperature: 1,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
          ...(options.responseFormat === false ? {} : { response_format: { type: "json_object" } }),
        }),
      }, { provider: "Azure OpenAI", timeoutMs });
      const body = await response.text();
      if (!response.ok) throw new Error(`Azure OpenAI retornou ${response.status}: ${body}`);
      return JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Azure OpenAI excedeu o tempo limite de ${Math.round(timeoutMs / 1_000)} segundos.`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class AzureOpenAIProvider extends KimiProvider {
  provider = "AZURE_OPENAI" as ExtractionProvider;

  constructor() {
    super(new AzureOpenAIClient());
  }

  async structureText(text: string, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const focusedText = focusDocumentText(text, checklist);
    const tokenized = tokenizeSensitiveText(focusedText);
    const result = await this.client.completeJson([
      {
        role: "system",
        content:
          "Você estrutura texto bruto de documentos imobiliários. Identifique todos os compradores/adquirentes separadamente. " +
          "Diferencie endereço residencial do endereço do imóvel. Retorne somente JSON válido no formato " +
          "{\"fields\":[{\"fieldId\":string,\"participantId\":string|null,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. " +
          "rawText deve ser apenas o pequeno trecho que sustenta o valor. Não compare campos.",
      },
      {
        role: "user",
        content:
          `Texto bruto:\n${tokenized.text}\n\nIMPORTANTE: marcadores entre colchetes, como [PESSOA_01], [CPF_01], [EMAIL_01], [TELEFONE_01], [RG_01] e [ENDERECO_01], representam valores reais protegidos. Quando sustentarem um campo solicitado, devolva o marcador exatamente como aparece, incluindo os colchetes. Não os trate como ausência de dado.\n\nCampos esperados:\n${checklistPrompt(checklist)}`,
      },
    ], { timeoutMs: 75_000 });
    return enrichStandardFinancialFields(
      restoreTokenizedOutput(coerceExtractionOutput(result, checklist), tokenized.replacements),
      text,
      checklist,
    );
  }
}
