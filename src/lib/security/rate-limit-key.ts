export function requestRateLimitKey(request: Request, namespace: string) {
  const address = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  return `${namespace}:${address}`;
}
