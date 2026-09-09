export function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code.toUpperCase().replace(/[^A-Z0-9_:-]/g, "_").slice(0, 80);
  }
  if (error instanceof Error && /timeout|abort/i.test(error.message)) return "TIMEOUT";
  return "UNEXPECTED_ERROR";
}

export function logOperationalError(event: string, error: unknown, context: Record<string, string | number | boolean | null> = {}) {
  // Never log provider payloads, document names, request bodies, or raw error messages.
  console.error(JSON.stringify({ event, errorCode: errorCode(error), ...context }));
}

export function publicOperationalError(error: unknown, fallback: string) {
  return errorCode(error) === "TIMEOUT" ? "A operação excedeu o tempo disponível. Tente novamente." : fallback;
}
