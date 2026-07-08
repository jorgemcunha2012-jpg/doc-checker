export function processCode(processId: string) {
  return `OP-${processId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
