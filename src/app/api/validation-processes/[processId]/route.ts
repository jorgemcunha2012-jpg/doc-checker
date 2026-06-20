import { NextResponse } from "next/server";
import { getValidationProcess } from "@/services/process/validation-process-store";

export async function GET(_request: Request, context: { params: Promise<{ processId: string }> }) {
  const { processId } = await context.params;
  const process = getValidationProcess(processId);

  if (!process) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  return NextResponse.json(process);
}
