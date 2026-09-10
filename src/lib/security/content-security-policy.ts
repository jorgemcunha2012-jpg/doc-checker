export function contentSecurityPolicy(nonce: string, environment: NodeJS.ProcessEnv = process.env) {
  const isDevelopment = environment.NODE_ENV === "development";
  const supabaseSources = supabaseConnectSources(environment.NEXT_PUBLIC_SUPABASE_URL);
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${supabaseSources}`,
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "frame-src 'self' blob:",
    "media-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

function supabaseConnectSources(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const websocketUrl = new URL(url);
    websocketUrl.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return ` ${url.origin} ${websocketUrl.origin}`;
  } catch {
    return "";
  }
}
