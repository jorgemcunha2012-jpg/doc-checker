import type { DocumentSource, ExtractionQualityReport } from "@/domain/validation";
import { documentSourceLabels } from "@/domain/validation";

export type ExtractionAlertProcess = {
  final_status: string;
  error?: string | null;
  summary?: {
    unreadable?: number;
    extractionQualityBySource?: Partial<Record<DocumentSource, ExtractionQualityReport>>;
  } | null;
};

export type ExtractionAlert = {
  label: string;
  detail: string;
  severity: "critical" | "warning";
};

export function extractionAlert(process: ExtractionAlertProcess): ExtractionAlert | null {
  if (process.final_status === "FAILED") {
    return {
      label: "Conferência falhou",
      detail: process.error ?? "O processo terminou sem resultado utilizável.",
      severity: "critical",
    };
  }

  const reports = Object.values(process.summary?.extractionQualityBySource ?? {}).filter(
    (report): report is ExtractionQualityReport => Boolean(report),
  );
  const failedReports = reports.filter((report) => report.status === "FAILED" || report.coverage === 0);
  if (failedReports.length) {
    return {
      label: `Extração não ocorreu em ${sourceList(failedReports)}`,
      detail: alertDetail(failedReports),
      severity: "critical",
    };
  }

  const unreadable = process.summary?.unreadable ?? 0;
  if (unreadable > 0) {
    return {
      label: `${unreadable} campo(s) com fonte ilegível`,
      detail: "A conferência terminou, mas algum documento não pôde ser interpretado integralmente.",
      severity: "critical",
    };
  }

  const partialReports = reports.filter(
    (report) =>
      report.status === "PARTIAL" ||
      report.missingCriticalFields.length > 0 ||
      report.lowConfidenceCriticalFields.length > 0 ||
      report.ambiguousCriticalFields.length > 0,
  );
  if (partialReports.length) {
    return {
      label: `Extração parcial em ${sourceList(partialReports)}`,
      detail: alertDetail(partialReports),
      severity: "warning",
    };
  }

  return null;
}

function sourceList(reports: ExtractionQualityReport[]) {
  return reports.map((report) => documentSourceLabels[report.source]).join(", ");
}

function alertDetail(reports: ExtractionQualityReport[]) {
  const lowestCoverage = Math.min(...reports.map((report) => report.coverage));
  const missing = reports.reduce((total, report) => total + report.missingCriticalFields.length, 0);
  const lowConfidence = reports.reduce((total, report) => total + report.lowConfidenceCriticalFields.length, 0);
  const ambiguous = reports.reduce((total, report) => total + report.ambiguousCriticalFields.length, 0);
  return `Cobertura mínima ${lowestCoverage}% · críticos ausentes ${missing} · baixa confiança ${lowConfidence} · conflitos ${ambiguous}`;
}
