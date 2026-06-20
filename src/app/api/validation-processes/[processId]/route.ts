import { NextResponse } from "next/server";
import { getValidationProcess } from "@/services/process/validation-process-store";

export async function GET(_request: Request, context: { params: Promise<{ processId: string }> }) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json({ error: "Consulta por polling indisponível no ambiente serverless. Use o resultado retornado no POST." }, { status: 410 });
  }

  const { processId } = await context.params;
  const validationProcess = getValidationProcess(processId);

  if (!validationProcess) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  return NextResponse.json(validationProcess);
}
