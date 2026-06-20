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

  async completeJson(messages: ChatMessage[]) {
    const { apiKey, baseUrl, model, providerName } = this.config;

    if (!apiKey || !baseUrl || !model) {
      throw new Error(`${providerName} não configurado. Confira API key, base URL e modelo no .env.`);
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${providerName} retornou ${response.status}: ${body}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(`${providerName} não retornou conteúdo estruturado.`);
    }

    return JSON.parse(content) as unknown;
  }
}
