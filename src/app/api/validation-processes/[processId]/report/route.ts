import { NextResponse } from "next/server";
import { renderValidationReport } from "@/services/report/validation-report";
import { getValidationProcess } from "@/services/process/validation-process-store";

export async function GET(_request: Request, context: { params: Promise<{ processId: string }> }) {
  const { processId } = await context.params;
  const process = getValidationProcess(processId);

  if (!process?.result) {
    return NextResponse.json({ error: "Relatório indisponível para este processo." }, { status: 404 });
  }

  const buffer = await renderValidationReport(process.result);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="conferia-${process.id}.pdf"`,
    },
  });
}
