import type { ValidationProcess } from "@/domain/validation";

const processes = new Map<string, ValidationProcess>();

export function saveValidationProcess(process: ValidationProcess) {
  processes.set(process.id, process);
  return process;
}

export function getValidationProcess(id: string) {
  return processes.get(id);
}

export function updateValidationProcess(id: string, patch: Partial<ValidationProcess>) {
  const current = processes.get(id);

  if (!current) {
    return undefined;
  }

  const next: ValidationProcess = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  processes.set(id, next);
  return next;
}
