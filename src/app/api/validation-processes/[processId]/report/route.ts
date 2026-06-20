import { NextResponse } from "next/server";
import { renderValidationReport } from "@/services/report/validation-report";
import { getValidationProcess } from "@/services/process/validation-process-store";

export async function GET(_request: Request, context: { params: Promise<{ processId: string }> }) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json({ error: "Relatório por processId indisponível no ambiente serverless. Use /api/reports/validation com o snapshot." }, { status: 410 });
  }

  const { processId } = await context.params;
  const validationProcess = getValidationProcess(processId);

  if (!validationProcess?.result) {
    return NextResponse.json({ error: "Relatório indisponível para este processo." }, { status: 404 });
  }

  const buffer = await renderValidationReport(validationProcess.result);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="conferia-${validationProcess.id}.pdf"`,
    },
  });
}
