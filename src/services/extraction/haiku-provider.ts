import type { ChecklistField, ProviderExtractionOutput } from "@/domain/validation";
import type { DocumentExtractionProvider, UploadedDocumentPayload } from "./types";
import { enrichStandardFinancialFields, focusDocumentText } from "./deepseek-provider";
import { parseJsonResponse } from "./openai-compatible-client";
import { checklistPrompt, coerceExtractionOutput } from "./provider-utils";

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

type HaikuContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | {
          type: "image";
          source: { type: "base64"; media_type: string; data: string };
        }
    >;

export class HaikuProvider implements DocumentExtractionProvider {
  provider = "HAIKU" as const;

  async structureText(text: string, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const focusedText = focusDocumentText(text, checklist);
    const content = await this.request(focusedText, checklist);
    return enrichStandardFinancialFields(coerceExtractionOutput(parseJsonResponse(content), checklist), text, checklist);
  }

  async extractFromImage(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    return this.extractImageFields(
      document,
      checklist,
      "Você extrai dados documentais imobiliários de imagens. Extraia apenas valores explicitamente visíveis e só retorne valor acompanhado de uma evidência curta contendo rótulo e valor. Não compare campos.",
      `Extraia os campos visíveis sem assumir layout fixo.\n${checklistPrompt(checklist)}`,
      2_400,
    );
  }

  async extractReservationFromImage(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const fieldIds = [
      "buyer.name", "buyer.cpf", "buyer.rg", "buyer.maritalStatus", "buyer.address", "buyer.email", "buyer.phone",
      "property.development", "property.registration", "property.unit", "property.tower",
      "financial.totalValue", "financial.financing", "financial.fgts", "financial.subsidy", "financial.downPayment",
    ];
    return this.extractImageFields(
      document,
      checklist.filter((field) => fieldIds.includes(field.id)),
      "Você extrai telas de reserva imobiliária. Leia rótulos e valores mesmo quando o valor estiver abaixo do rótulo. Diferencie endereço do cliente do endereço do imóvel. Não invente valores e omita campos ausentes.",
      "Mapeamento: Cliente -> buyer.name; Telefone -> buyer.phone; E-mail -> buyer.email; Unidade no formato EMPREENDIMENTO / TORRE X / APTO -> property.development, property.tower e property.unit; Valor do contrato -> financial.totalValue; Financiamento -> financial.financing; FGTS -> financial.fgts somente se explícito; Subsídio -> financial.subsidy somente se explícito. Sinal não é Entrada Moradia.\n\n" + checklistPrompt(checklist.filter((field) => fieldIds.includes(field.id))),
      2_400,
      checklist,
    );
  }

  async extractReservationFinancialComponentsFromImage(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const fields = checklist.filter((field) => ["financial.totalValue", "financial.financing", "financial.fgts", "financial.subsidy"].includes(field.id));
    return this.extractImageFields(
      document,
      fields,
      "Você confere exclusivamente tabelas de condição de pagamento imobiliária. Extraia somente valores explicitamente visíveis. Não confunda Sinal, Mensal, Bônus ou Entrada Moradia com recursos próprios. Não calcule nem infira.",
      "Mapeamento obrigatório: Valor do contrato -> financial.totalValue; Financiamento -> financial.financing; FGTS -> financial.fgts; Subsídio ou Desconto concedido -> financial.subsidy. A evidência de cada campo deve conter o rótulo e o valor da própria linha.\n\n" + checklistPrompt(fields),
      1_800,
      checklist,
    );
  }

  async extractReservationPreRegistrationFinancials(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    const fields = checklist.filter((field) => ["financial.appraisalValue", "financial.financing", "financial.subsidy", "financial.fgts"].includes(field.id));
    return this.extractImageFields(
      document,
      fields,
      "Você extrai exclusivamente o resumo de pré-cadastro imobiliário. Leia rótulos e valores exatamente como aparecem. Não calcule nem infira.",
      "Mapeamento: Valor Avaliação -> financial.appraisalValue; Valor Aprovado -> financial.financing; Valor Subsídio -> financial.subsidy; Valor FGTS -> financial.fgts.\n\n" + checklistPrompt(fields),
      1_200,
      checklist,
    );
  }

  async extractReservationIdentityFromImage(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    return this.extractReservationSection(document, checklist, ["buyer.name", "buyer.cpf", "buyer.rg", "buyer.maritalStatus", "buyer.address", "buyer.email", "buyer.phone"], "Leia exclusivamente a ficha de dados do cliente: nome, CPF, RG, estado civil, endereço completo, e-mail e telefone. Cada evidência precisa conter o rótulo e o valor correspondente.");
  }

  async extractReservationUnitFromImage(document: UploadedDocumentPayload, checklist: ChecklistField[]): Promise<ProviderExtractionOutput> {
    return this.extractReservationSection(document, checklist, ["property.development", "property.registration", "property.unit", "property.tower"], "Leia exclusivamente o bloco Unidade. Extraia empreendimento, torre, unidade/apartamento e matrícula. Quando o valor vier no formato EMPREENDIMENTO / TORRE X / UNIDADE, separe cada componente.");
  }

  async transcribeReservationImage(document: UploadedDocumentPayload): Promise<string> {
    return this.request([
      { type: "text", text: "Transcreva fielmente todos os rótulos e valores da tela de reserva. Preserve quebras de linha e valores monetários. Não interprete, compare ou resuma." },
      imageContent(document),
    ], [], 2_400);
  }

  private async extractReservationSection(document: UploadedDocumentPayload, checklist: ChecklistField[], fieldIds: string[], instruction: string) {
    const fields = checklist.filter((field) => fieldIds.includes(field.id));
    return this.extractImageFields(document, fields, "Você revisa uma tela imobiliária recorrente. Extraia apenas valores explicitamente visíveis, com evidência curta. Não invente valores.", `${instruction}\n\n${checklistPrompt(fields)}`, 2_400, checklist);
  }

  private async extractImageFields(
    document: UploadedDocumentPayload,
    requestedChecklist: ChecklistField[],
    system: string,
    instruction: string,
    maxTokens: number,
    outputChecklist = requestedChecklist,
  ): Promise<ProviderExtractionOutput> {
    const content = await this.request([
      { type: "text", text: `${instruction}\n\nResponda somente JSON válido no formato {"fields":[{"fieldId":string,"participantId":string|null,"value":string,"confidence":number,"sourceLocation":{"section":string|null,"rawText":string|null}}]}.` },
      imageContent(document),
    ], requestedChecklist, maxTokens, system);
    const output = coerceExtractionOutput(parseJsonResponse(content), requestedChecklist);
    if (outputChecklist === requestedChecklist) return output;
    const byId = new Map(output.fields.map((field) => [field.fieldId, field]));
    return { fields: outputChecklist.map((field) => byId.get(field.id) ?? { fieldId: field.id, value: null, confidence: 0 }) };
  }

  private async request(content: HaikuContent, checklist: ChecklistField[], maxTokens = 2_400, system?: string) {
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
          max_tokens: maxTokens,
          system: system ?? "Você estrutura texto bruto de documentos imobiliários. Identifique todos os compradores/adquirentes separadamente. Para campos repetíveis, retorne uma entrada por pessoa e use participantId buyer_1, buyer_2 etc. de forma consistente em todos os campos da mesma pessoa. Diferencie rigorosamente endereço residencial, endereço do imóvel e endereço do vendedor. Se não houver evidência suficiente, retorne null e confiança 0. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"participantId\":string|null,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. rawText deve conter somente o pequeno trecho que sustenta o valor. Não compare campos.",
          messages: [{ role: "user", content: typeof content === "string" ? `Texto bruto:\n${content}\n\nCampos esperados:\n${checklistPrompt(checklist)}` : content }],
        }),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`Haiku retornou ${response.status}: ${body}`);
      const parsed = JSON.parse(body) as AnthropicResponse;
      const responseContent = parsed.content?.find((item) => item.type === "text")?.text;
      if (!responseContent) throw new Error("Haiku não retornou conteúdo estruturado.");
      return responseContent;
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Haiku excedeu o tempo limite de 60 segundos.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function imageContent(document: UploadedDocumentPayload) {
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: document.mimeType,
      data: document.buffer.toString("base64"),
    },
  };
}
