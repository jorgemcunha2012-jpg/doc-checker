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
    const focusedText = focusDocumentText(text, checklist);
    const result = await this.client.completeJson([
      {
        role: "system",
        content:
          "Você estrutura texto bruto de documentos imobiliários. Identifique todos os compradores/adquirentes separadamente. Para campos repetíveis, retorne uma entrada por pessoa e use participantId buyer_1, buyer_2 etc. de forma consistente em nome, CPF, RG, estado civil, endereço, email e telefone da mesma pessoa. Diferencie rigorosamente o endereço residencial das partes do endereço do imóvel objeto do negócio. Use a seção e o sujeito do texto como evidência; nunca copie um endereço para campos semanticamente diferentes por mera proximidade. Se o contexto não identificar o titular do endereço, retorne null e confiança 0. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"participantId\":string|null,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. rawText deve ser apenas o pequeno trecho que sustenta o valor. Não compare campos.",
      },
      {
        role: "user",
        content: `Texto bruto:\n${focusedText}\n\nCampos esperados:\n${checklistPrompt(checklist)}`,
      },
    ], { timeoutMs: 75_000 });

    const output = enrichStandardFinancialFields(coerceExtractionOutput(result, checklist), text, checklist);
    if (focusedText.length < text.length && shouldRetryWithBroaderContext(output, checklist)) {
      const broaderResult = await this.client.completeJson([
        {
          role: "system",
          content:
            "Você estrutura texto bruto de documentos imobiliários. Identifique todos os compradores/adquirentes separadamente. Para campos repetíveis, retorne uma entrada por pessoa e use participantId buyer_1, buyer_2 etc. de forma consistente em todos os campos da mesma pessoa. Diferencie rigorosamente o endereço residencial das partes do endereço do imóvel objeto do negócio. Se o contexto não identificar o titular do endereço, retorne null e confiança 0. Responda somente JSON válido no formato {\"fields\":[{\"fieldId\":string,\"participantId\":string|null,\"value\":string|null,\"confidence\":number,\"sourceLocation\":{\"page\":number|null,\"section\":string|null,\"rawText\":string|null}}]}. rawText deve ser apenas o pequeno trecho que sustenta o valor. Não compare campos.",
        },
        {
          role: "user",
          content: `Texto bruto:\n${compactDocumentText(text)}\n\nCampos esperados:\n${checklistPrompt(checklist)}`,
        },
      ], { timeoutMs: 95_000 });

      return enrichStandardFinancialFields(coerceExtractionOutput(broaderResult, checklist), text, checklist);
    }

    return output;
  }
}

export function focusDocumentText(text: string, checklist: ChecklistField[]) {
  const maximumCharacters = 13_500;
  if (text.length <= maximumCharacters) {
    return text;
  }

  const windows = documentWindows(text, 900, 450);
  const keywords = checklist.flatMap(fieldKeywords);
  const scored = windows
    .map((window, index) => ({
      index,
      text: window,
      score: scoreWindow(window, keywords),
    }))
    .filter((window) => window.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const selected = new Map<number, string>();
  selected.set(0, text.slice(0, 3_500));
  selected.set(Number.MAX_SAFE_INTEGER, text.slice(-2_000));

  for (const domainKeywords of keywordGroupsByDomain(checklist)) {
    const best = windows
      .map((window, index) => ({ index, text: window, score: scoreWindow(window, domainKeywords) }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0];
    if (best?.score > 0) selectWithinBudget(selected, best.index, best.text, maximumCharacters);
  }

  for (const window of scored) {
    selectWithinBudget(selected, window.index, window.text, maximumCharacters);
  }

  const focused = [...selected.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, value]) => value.trim())
    .filter(Boolean)
    .join("\n\n[TRECHO RELEVANTE]\n\n");

  return focused.length > maximumCharacters ? focused.slice(0, maximumCharacters) : focused;
}

export function enrichStandardFinancialFields(
  output: ProviderExtractionOutput,
  text: string,
  checklist: ChecklistField[],
) {
  const standardItems: Record<string, string> = {
    "financial.financing": "B.4.1",
    "financial.entry": "B.4.2",
    "financial.fgts": "B.4.3",
    "financial.subsidy": "B.4.5",
  };
  const allowedIds = new Set(checklist.map((field) => field.id));

  return {
    fields: output.fields.map((field) => {
      const item = standardItems[field.fieldId];
      if (!item || field.value || !allowedIds.has(field.fieldId)) return field;
      const line = text.split(/\r?\n/).find((candidate) => candidate.includes(item) && /R\$\s*[\d.,]+/.test(candidate));
      const value = line?.match(/R\$\s*[\d.,]+/)?.[0];
      if (!value || !line) return field;
      return {
        ...field,
        value,
        confidence: 100,
        sourceLocation: {
          section: "Composição dos recursos",
          rawText: line.slice(0, 500),
        },
      };
    }),
  };
}

function keywordGroupsByDomain(checklist: ChecklistField[]) {
  const groups = new Map<string, string[]>();
  for (const field of checklist) {
    const domain = field.id.split(".")[0];
    groups.set(domain, [...(groups.get(domain) ?? []), ...fieldKeywords(field)]);
  }
  return [...groups.values()];
}

function selectWithinBudget(selected: Map<number, string>, index: number, text: string, maximumCharacters: number) {
  if (selected.has(index)) return;
  if (currentLength([...selected.values()]) + text.length > maximumCharacters) return;
  selected.set(index, text);
}

function shouldRetryWithBroaderContext(output: ProviderExtractionOutput, checklist: ChecklistField[]) {
  const requiredFields = checklist.filter((field) => field.required);
  if (!requiredFields.length) return false;
  const filledRequired = requiredFields.filter((field) => output.fields.some((item) => item.fieldId === field.id && item.value)).length;
  const filledTotal = output.fields.filter((field) => field.value).length;

  return filledRequired / requiredFields.length < 0.35 && filledTotal < 6;
}

function documentWindows(text: string, size: number, step: number) {
  const windows: string[] = [];
  for (let index = 0; index < text.length; index += step) {
    windows.push(text.slice(index, index + size));
  }
  return windows;
}

function fieldKeywords(field: ChecklistField) {
  const idTokens = field.id.split(/[.\-_]/g);
  const labelTokens = `${field.label} ${field.category}`.split(/\s+/g);
  const domainKeywords: Record<string, string[]> = {
    buyer: ["comprador", "adquirente", "cliente", "cpf", "rg", "estado civil", "email", "telefone"],
    seller: ["vendedor", "transmitente", "cnpj", "razão social"],
    property: ["imóvel", "matrícula", "unidade", "torre", "empreendimento", "área", "fração ideal", "iptu"],
    financial: ["valor", "entrada", "financiamento", "fgts", "subsídio", "recurso", "declaração"],
    contract: ["contrato", "instrumento", "data"],
    signature: ["assinatura", "cidade", "local"],
  };
  const semantic = Object.entries(domainKeywords)
    .filter(([prefix]) => field.id.startsWith(prefix))
    .flatMap(([, values]) => values);

  return [...idTokens, ...labelTokens, field.fieldType, ...semantic]
    .map((value) => normalizeKeyword(value))
    .filter((value) => value.length >= 3);
}

function scoreWindow(window: string, keywords: string[]) {
  const normalizedWindow = normalizeKeyword(window);
  let score = 0;
  for (const keyword of new Set(keywords)) {
    if (normalizedWindow.includes(keyword)) score += keyword.includes(" ") ? 3 : 1;
  }
  return score;
}

function normalizeKeyword(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function currentLength(values: string[]) {
  return values.reduce((total, value) => total + value.length, 0);
}

function compactDocumentText(text: string) {
  const maximumCharacters = 22_000;
  if (text.length <= maximumCharacters) {
    return text;
  }

  const headSize = 17_000;
  const tailSize = maximumCharacters - headSize;
  return `${text.slice(0, headSize)}\n\n[CONTEÚDO INTERMEDIÁRIO OMITIDO]\n\n${text.slice(-tailSize)}`;
}
