import { NextResponse } from "next/server";
import type { ValidationRun } from "@/domain/validation";
import { renderValidationReport, type ReportFilter } from "@/services/report/validation-report";
import { AuthError, requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  let run: ValidationRun;
  let filter: ReportFilter = "ALL";

  try {
    const body = await request.json() as ValidationRun | { run: ValidationRun; filter?: ReportFilter };
    if ("run" in body) {
      run = body.run;
      if (body.filter && ["ALL", "DIVERGENCES", "PENDING", "CHECKED"].includes(body.filter)) filter = body.filter;
    } else {
      run = body;
    }
  } catch {
    return NextResponse.json({ error: "JSON inválido para geração do relatório." }, { status: 400 });
  }

  if (!run?.results?.length) {
    return NextResponse.json({ error: "Resultado de validação inválido." }, { status: 400 });
  }

  const buffer = await renderValidationReport(run, filter);
  const suffix = filter === "ALL" ? "completo" : filter.toLowerCase();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="conferia-${run.id}-${suffix}.pdf"`,
    },
  });
}
