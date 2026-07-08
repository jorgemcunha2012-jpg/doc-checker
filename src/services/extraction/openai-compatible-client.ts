type ChatMessage = {
  role: "system" | "user";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type OpenAICompatibleConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  providerName: string;
};

export class OpenAICompatibleClient {
  constructor(private readonly config: OpenAICompatibleConfig) {}

  async completeText(
    messages: ChatMessage[],
    options: { timeoutMs?: number; maxTokens?: number } = {},
  ) {
    const payload = await this.request(messages, {
      timeoutMs: options.timeoutMs,
      maxTokens: options.maxTokens,
      responseFormat: false,
    });
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${this.config.providerName} não retornou texto.`);
    }
    return stripCodeFence(content);
  }

  async completeJson(
    messages: ChatMessage[],
    options: { timeoutMs?: number; maxTokens?: number; responseFormat?: boolean } = {},
  ) {
    const payload = await this.request(messages, options);
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(`${this.config.providerName} não retornou conteúdo estruturado.`);
    }

    return parseJsonResponse(content);
  }

  private async request(
    messages: ChatMessage[],
    options: { timeoutMs?: number; maxTokens?: number; responseFormat?: boolean } = {},
  ) {
    const { apiKey, baseUrl, model, providerName } = this.config;

    if (!apiKey || !baseUrl || !model) {
      throw new Error(`${providerName} não configurado. Confira API key, base URL e modelo no .env.`);
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 1,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.responseFormat === false ? {} : { response_format: { type: "json_object" } }),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${providerName} retornou ${response.status}: ${body}`);
    }

    return (await response.json()) as ChatCompletionResponse;
  }
}

function parseJsonResponse(content: string): unknown {
  const json = stripCodeFence(content);

  try {
    return JSON.parse(json) as unknown;
  } catch (error) {
    const candidates = [
      sliceCompleteJson(json, "{", "}"),
      sliceCompleteJson(json, "[", "]"),
    ].filter((candidate): candidate is string => candidate !== null);

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        // Continue looking for a complete JSON object or array.
      }
    }

    const partialFields = parsePartialFields(json);
    if (partialFields.fields.length) {
      return partialFields;
    }

    throw error;
  }
}

function stripCodeFence(content: string) {
  let value = content.trim();
  if (value.startsWith("```")) {
    value = value
      .replace(/^```(?:json|text|markdown)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return value;
}

function parsePartialFields(content: string) {
  const fields: Array<Record<string, unknown>> = [];
  const objectLikeFields = content.matchAll(/"fieldId"\s*:\s*"([^"]+)"[\s\S]*?"value"\s*:\s*(?:"([^"]*)"|null)[\s\S]*?"confidence"\s*:\s*([0-9.]+)/g);

  for (const match of objectLikeFields) {
    fields.push({
      fieldId: match[1],
      value: match[2] ?? null,
      confidence: Number(match[3]),
    });
  }

  return { fields };
}

function sliceCompleteJson(
  content: string,
  opening: "{" | "[",
  closing: "}" | "]",
) {
  const start = content.indexOf(opening);
  const end = content.lastIndexOf(closing);

  return start >= 0 && end > start ? content.slice(start, end + 1) : null;
}
