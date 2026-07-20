import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import type { DevelopmentExtraction } from "@/domain/development";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

export async function extractDevelopmentFromXlsx(buffer: Buffer, sourceDocumentName: string): Promise<DevelopmentExtraction> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const sheet = zip.file("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("A planilha não possui uma primeira aba legível.");
  const xml = await sheet.async("text");
  const document = new DOMParser().parseFromString(xml, "text/xml");
  const rows = Array.from(document.getElementsByTagNameNS(NS, "row"));
  if (!rows.length) throw new Error("A planilha não possui linhas de dados.");

  const matrix = rows.map((row) => readRow(row, sharedStrings));
  const headers = matrix[0].map(normalizeHeader);
  const columns = {
    tower: findColumn(headers, ["torre", "bloco"]),
    unit: findColumn(headers, ["unidade", "apartamento", "apto"]),
    typology: findColumn(headers, ["tipo", "tipologia"]),
    privateArea: findColumn(headers, ["area privativa", "area util"]),
    commonArea: findColumn(headers, ["area comum"]),
    totalArea: findColumn(headers, ["area total"]),
    idealFraction: findColumn(headers, ["fracao ideal"]),
    iptuRegistration: findColumn(headers, ["inscricao iptu", "iptu", "inscricao imobiliaria"]),
  };
  if (columns.typology < 0 || columns.privateArea < 0) {
    throw new Error("A planilha precisa conter as colunas Tipo e Área Privativa.");
  }

  const units = matrix.slice(1).flatMap((row, index) => {
    const privateArea = formatNumber(row[columns.privateArea]);
    const typology = clean(row[columns.typology]);
    if (!privateArea || !typology) return [];
    return [{
      tower: clean(row[columns.tower]),
      unit: clean(row[columns.unit]),
      typology: `Tipo ${typology.replace(/^tipo\s*/i, "").toUpperCase()}`,
      privateArea,
      ...(columns.commonArea >= 0 && formatNumber(row[columns.commonArea]) ? { commonArea: formatNumber(row[columns.commonArea]) } : {}),
      ...(columns.totalArea >= 0 && formatNumber(row[columns.totalArea]) ? { totalArea: formatNumber(row[columns.totalArea]) } : {}),
      ...(columns.idealFraction >= 0 && formatNumber(row[columns.idealFraction]) ? { idealFraction: formatNumber(row[columns.idealFraction]) } : {}),
      ...(columns.iptuRegistration >= 0 && clean(row[columns.iptuRegistration]) ? { iptuRegistration: clean(row[columns.iptuRegistration]) } : {}),
      confidence: 99,
      evidence: { rawText: `Linha ${index + 2}: ${row.filter(Boolean).join(" | ")}`.slice(0, 500) },
    }];
  });
  if (!units.length) throw new Error("A planilha não apresentou linhas com tipo e área privativa.");

  return {
    name: inferName(sourceDocumentName),
    registration: inferRegistration(sourceDocumentName),
    units,
    quality: { reviewRequired: [], warnings: [], sourcesCompared: ["XLSX"], detectedTypologies: [...new Set(units.map((unit) => unit.typology!))] },
  };
}

async function readSharedStrings(zip: JSZip) {
  const file = zip.file("xl/sharedStrings.xml");
  if (!file) return [];
  const xml = await file.async("text");
  const document = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(document.getElementsByTagNameNS(NS, "si")).map((item) =>
    Array.from(item.getElementsByTagNameNS(NS, "t")).map((node) => node.textContent ?? "").join(""),
  );
}

function readRow(row: Element, sharedStrings: string[]) {
  const values: string[] = [];
  for (const cell of Array.from(row.getElementsByTagNameNS(NS, "c"))) {
    const reference = cell.getAttribute("r") ?? "";
    const column = reference.match(/[A-Z]+/)?.[0] ?? "";
    const index = columnToIndex(column);
    const valueNode = cell.getElementsByTagNameNS(NS, "v")[0];
    const inlineNode = cell.getElementsByTagNameNS(NS, "t")[0];
    let value = valueNode?.textContent ?? inlineNode?.textContent ?? "";
    if (cell.getAttribute("t") === "s" && value) value = sharedStrings[Number(value)] ?? "";
    values[index] = value.trim();
  }
  return values;
}

function findColumn(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.some((alias) => header === alias || header.includes(alias)));
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s*\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function columnToIndex(value: string) {
  return [...value].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function clean(value?: string) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function formatNumber(value?: string) {
  const raw = clean(value);
  if (!raw) return "";
  const number = raw.includes(",") ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw);
  if (!Number.isFinite(number)) {
    const decimal = Number(raw);
    return Number.isFinite(decimal) ? decimal.toString().replace(".", ",") : raw;
  }
  return number.toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 12 });
}

function inferName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/^lista[_ -]?unidades[_ -]?/i, "").replace(/[_ -]+\d+(?:[._-]\d+)*$/, "").trim();
  return base ? base.replace(/[_-]+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) : "Empreendimento sem nome";
}

function inferRegistration(fileName: string) {
  return fileName.match(/(?:^|[_ -])(\d{2,}(?:[._-]\d+)+)(?:\.[^.]+$)/)?.[1]?.replace(/-/g, ".");
}
