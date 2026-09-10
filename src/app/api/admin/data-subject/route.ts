import { NextResponse } from "next/server";
import { AuthError, requireMasterAdmin } from "@/lib/auth";
import { audit } from "@/services/process/process-repository";
import {
  eraseDataSubjectByCpf,
  exportDataSubjectByCpf,
} from "@/services/security/data-subject-rights";
import { dataSubjectRequestFingerprint, normalizeCpf } from "@/services/security/data-subject-identifier";
import { logOperationalError } from "@/lib/security/operational-logger";

export async function GET(request: Request) {
  try {
    const admin = await requireMasterAdmin();
    const cpf = normalizeCpf(new URL(request.url).searchParams.get("cpf") ?? "");
    const exportData = await exportDataSubjectByCpf(cpf);
    await audit(admin, "DATA_SUBJECT_EXPORTED", "data_subject", dataSubjectRequestFingerprint(cpf), {
      processCount: exportData.processes.length,
    });
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="conferia-titular-${dataSubjectRequestFingerprint(cpf).slice(0, 12)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, "DATA_SUBJECT_EXPORT_FAILED");
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireMasterAdmin();
    const body = await request.json() as { cpf?: string; confirmation?: string };
    const cpf = normalizeCpf(body.cpf ?? "");
    if (body.confirmation !== "EXCLUIR") {
      return NextResponse.json({ error: "Confirmação obrigatória." }, { status: 400 });
    }
    const result = await eraseDataSubjectByCpf(cpf);
    await audit(admin, "DATA_SUBJECT_ERASED", "data_subject", dataSubjectRequestFingerprint(cpf), {
      processCount: result.processCount,
      storageFileCount: result.storageFileCount,
    });
    return NextResponse.json({ deleted: true, processCount: result.processCount, storageFileCount: result.storageFileCount });
  } catch (error) {
    return errorResponse(error, "DATA_SUBJECT_ERASURE_FAILED");
  }
}

function errorResponse(error: unknown, event: string) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  logOperationalError(event, error);
  const message = error instanceof Error ? error.message : "Não foi possível atender a solicitação do titular.";
  return NextResponse.json({ error: message }, { status: 500 });
}
