import { randomUUID } from "node:crypto";

const MAX_PROVIDER_PAYLOAD_BYTES = 25 * 1024 * 1024;

type ProviderGatewayOptions = {
  provider: string;
  timeoutMs: number;
};

export function assertAllowedProviderUrl(rawUrl: string, provider: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${provider} possui endereço de integração inválido.`);
  }
  if (url.protocol !== "https:") throw new Error(`${provider} exige conexão HTTPS.`);
  if (url.username || url.password) throw new Error(`${provider} não aceita credenciais na URL.`);
  const allowedHosts = new Set([
    ...(process.env.CONFERIA_PROVIDER_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
    ...(provider.toLowerCase().includes("deepseek") ? ["api.deepseek.com"] : []),
    ...(provider.toLowerCase().includes("kimi") ? ["api.moonshot.ai", "api.moonshot.cn"] : []),
    ...(provider.toLowerCase().includes("haiku") ? ["api.anthropic.com"] : []),
    ...(provider.toLowerCase().includes("azure") && process.env.AZURE_OPENAI_ENDPOINT
      ? [new URL(process.env.AZURE_OPENAI_ENDPOINT).hostname]
      : []),
  ]);
  if (!allowedHosts.has(url.hostname.toLowerCase())) throw new Error(`${provider} possui destino não autorizado.`);
  return url;
}

export async function fetchProvider(
  rawUrl: string,
  init: RequestInit,
  options: ProviderGatewayOptions,
) {
  const url = assertAllowedProviderUrl(rawUrl, options.provider);
  const body = typeof init.body === "string" ? init.body : undefined;
  if (body && Buffer.byteLength(body, "utf8") > MAX_PROVIDER_PAYLOAD_BYTES) {
    throw new Error(`${options.provider} recebeu um payload acima do limite permitido.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const headers = new Headers(init.headers);
  headers.set("x-conferia-request-id", randomUUID());
  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${options.provider} excedeu o tempo limite permitido.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
