import { NextResponse } from "next/server";
import type { ValidationRun } from "@/domain/validation";
import { renderValidationReport } from "@/services/report/validation-report";

export async function POST(request: Request) {
  let run: ValidationRun;

  try {
    run = (await request.json()) as ValidationRun;
  } catch {
    return NextResponse.json({ error: "JSON inválido para geração do relatório." }, { status: 400 });
  }

  if (!run?.results?.length) {
    return NextResponse.json({ error: "Resultado de validação inválido." }, { status: 400 });
  }

  const buffer = await renderValidationReport(run);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="conferia-${run.id}.pdf"`,
    },
  });
}
