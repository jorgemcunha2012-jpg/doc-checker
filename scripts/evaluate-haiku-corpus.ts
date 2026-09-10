import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { loadEnvConfig } from "@next/env";
import { getChecklist } from "@/domain/checklists";
import type { DocumentSource } from "@/domain/validation";
import { DocumentExtractionService } from "@/services/extraction/document-extraction-service";
import { ReconciliationEngine } from "@/services/validation/reconciliation-engine";

type CorpusPair = { minuta: string; siopi: string };

loadEnvConfig(process.cwd());
process.env.TEXT_EXTRACTION_PROVIDER = "HAIKU";
process.env.VISION_EXTRACTION_PROVIDER = "HAIKU";

void main();

async function main() {
  const pairs = process.argv.slice(2).map(parsePair);
  if (!pairs.length) {
    throw new Error("Informe pares no formato: minuta.rtf::espelho-siopi.pdf");
  }

  const checklist = getChecklist("RECONCILIATION");
  const sharedFields = checklist.filter((field) =>
    field.itemType === "COMPARISON" &&
    field.expectedSources?.includes("MINUTA") &&
    field.expectedSources.includes("SIOPI"),
  );
  const service = new DocumentExtractionService();
  const report = [];

  for (const pair of pairs) {
    const startedAt = Date.now();
    const result = await service.extractReconciliation({
      validationType: "RECONCILIATION",
      checklist,
      documents: [
        await documentPayload(pair.minuta, "MINUTA"),
        await documentPayload(pair.siopi, "SIOPI"),
      ],
    });
    const reconciliation = new ReconciliationEngine().run("evaluation", result);
    const available = new Map<DocumentSource, Set<string>>();
    for (const value of result.values) {
      if (value.value != null && String(value.value).trim()) {
        const fieldIds = available.get(value.source) ?? new Set<string>();
        fieldIds.add(value.fieldId);
        available.set(value.source, fieldIds);
      }
    }
    const minuta = available.get("MINUTA") ?? new Set<string>();
    const siopi = available.get("SIOPI") ?? new Set<string>();
    const shared = sharedFields.filter((field) => minuta.has(field.id) && siopi.has(field.id));

    report.push({
      documents: [basename(pair.minuta), basename(pair.siopi)],
      durationSeconds: Math.round((Date.now() - startedAt) / 1_000),
      minutaFieldsExtracted: minuta.size,
      siopiFieldsExtracted: siopi.size,
      sharedChecklistCoverage: `${shared.length}/${sharedFields.length}`,
      sharedChecklistMissing: sharedFields.filter((field) => !shared.some((candidate) => candidate.id === field.id)).map((field) => field.label),
      reconciliation: {
        checked: reconciliation.summary.totalChecked,
        matchOrPresent: reconciliation.summary.matches,
        divergences: reconciliation.summary.divergences,
        reviewRequired: reconciliation.summary.reviewRequired,
        unreadable: reconciliation.summary.unreadable,
      },
      unreadableSources: result.unreadableSources,
      sourceErrors: result.sourceErrors,
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

function parsePair(value: string): CorpusPair {
  const [minuta, siopi, ...extra] = value.split("::");
  if (!minuta || !siopi || extra.length) throw new Error(`Par inválido: ${value}`);
  return { minuta, siopi };
}

async function documentPayload(path: string, source: DocumentSource) {
  const buffer = await readFile(path);
  const extension = extname(path).toLowerCase();
  return {
    id: `${source}-${basename(path)}`,
    organizationId: "evaluation",
    name: basename(path),
    type: extension === ".pdf" ? "PDF" as const : "WORD" as const,
    source,
    mimeType: extension === ".pdf" ? "application/pdf" : "application/rtf",
    buffer,
  };
}
