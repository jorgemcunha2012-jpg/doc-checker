import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import type { DevelopmentExtraction } from "@/domain/development";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const HEADER_SCAN_LIMIT = 50;

type Columns = {
  tower: number;
  unit: number;
  typology: number;
  privateArea: number;
  commonArea: number;
  totalArea: number;
  idealFraction: number;
  iptuRegistration: number;
};

type TableCandidate = {
  sheetName: string;
  headerRowIndex: number;
  matrix: string[][];
  columns: Columns;
  score: number;
};

export async function extractDevelopmentFromXlsx(buffer: Buffer, sourceDocumentName: string): Promise<DevelopmentExtraction> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const candidate = await findBestTable(zip, sharedStrings);
  if (!candidate) {
    throw new Error("A planilha não apresentou uma tabela de unidades com colunas reconhecíveis.");
  }

  const { columns, headerRowIndex, matrix, sheetName } = candidate;
  if (columns.privateArea < 0) {
    throw new Error("A planilha precisa conter uma coluna de Área Privativa para cadastrar as unidades.");
  }

  const warnings = new Set<string>();
  if (columns.tower < 0) warnings.add("A planilha não possui coluna de torre ou bloco; esse dado poderá ser preenchido na revisão.");
  if (columns.unit < 0) warnings.add("A planilha não possui coluna de unidade ou apartamento; esse dado poderá ser preenchido na revisão.");
  if (columns.typology < 0) warnings.add("A planilha não possui coluna de tipo ou tipologia; as linhas foram mantidas para revisão.");

  const units = matrix.slice(headerRowIndex + 1).flatMap((row, index) => {
    const privateArea = formatNumber(row[columns.privateArea]);
    const tower = clean(row[columns.tower]);
    const unit = clean(row[columns.unit]);
    const rawTypology = clean(row[columns.typology]);

    // A line is useful when it identifies a unit or type and contains its area.
    // Do not discard tower/unit data merely because a supplier omitted "Tipo".
    if (!privateArea || (!rawTypology && !tower && !unit)) return [];

    return [{
      tower,
      unit,
      typology: rawTypology ? formatTypology(rawTypology) : "",
      privateArea,
      ...(valueAt(columns.commonArea, row) ? { commonArea: formatNumber(valueAt(columns.commonArea, row)) } : {}),
      ...(valueAt(columns.totalArea, row) ? { totalArea: formatNumber(valueAt(columns.totalArea, row)) } : {}),
      ...(valueAt(columns.idealFraction, row) ? { idealFraction: formatNumber(valueAt(columns.idealFraction, row)) } : {}),
      ...(valueAt(columns.iptuRegistration, row) ? { iptuRegistration: clean(valueAt(columns.iptuRegistration, row)) } : {}),
      confidence: 99,
      evidence: { rawText: `${sheetName}, linha ${headerRowIndex + index + 2}: ${row.filter(Boolean).join(" | ")}`.slice(0, 500) },
    }];
  });
  if (!units.length) throw new Error("A planilha não apresentou linhas com área privativa e dados de unidade, bloco ou tipo.");

  return {
    name: inferName(sourceDocumentName),
    registration: inferRegistration(sourceDocumentName),
    units,
    quality: {
      reviewRequired: columns.typology < 0 ? ["Confirme o tipo das unidades que vieram sem tipologia na planilha."] : [],
      warnings: [...warnings],
      sourcesCompared: ["XLSX"],
      detectedTypologies: [...new Set(units.map((unit) => unit.typology).filter(Boolean))],
    },
  };
}

async function findBestTable(zip: JSZip, sharedStrings: string[]) {
  const sheets = Object.keys(zip.files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort();
  const candidates: TableCandidate[] = [];

  for (const path of sheets) {
    const file = zip.file(path);
    if (!file) continue;
    const matrix = readWorksheet(await file.async("text"), sharedStrings);
    for (let index = 0; index < Math.min(matrix.length, HEADER_SCAN_LIMIT); index += 1) {
      const columns = findColumns(matrix[index].map(normalizeHeader));
      const score = scoreColumns(columns);
      if (score > 0) candidates.push({ sheetName: path.replace(/^.*\//, "").replace(/\.xml$/, ""), headerRowIndex: index, matrix, columns, score });
    }
  }
  return candidates.sort((left, right) => right.score - left.score || right.matrix.length - left.matrix.length)[0] ?? null;
}

function findColumns(headers: string[]): Columns {
  return {
    tower: findColumn(headers, ["torre", "bloco", "block", "edificio", "predio", "modulo"]),
    unit: findColumn(headers, ["unidade", "apartamento", "apto", "apt", "unid", "numero unidade", "codigo unidade"]),
    typology: findColumn(headers, ["tipo", "tipologia", "modelo unidade"]),
    privateArea: findColumn(headers, ["area privativa", "area util", "area exclusiva"]),
    commonArea: findColumn(headers, ["area comum", "area uso comum", "area de uso comum"]),
    totalArea: findColumn(headers, ["area total", "area global"]),
    idealFraction: findColumn(headers, ["fracao ideal", "fracao"]),
    iptuRegistration: findColumn(headers, ["inscricao iptu", "inscricao imobiliaria", "cadastro imobiliario", "iptu"]),
  };
}

function scoreColumns(columns: Columns) {
  if (columns.privateArea < 0) return 0;
  const identifiers = [columns.tower, columns.unit, columns.typology].filter((column) => column >= 0).length;
  const details = [columns.commonArea, columns.totalArea, columns.idealFraction, columns.iptuRegistration].filter((column) => column >= 0).length;
  return 10 + identifiers * 5 + details;
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

function readWorksheet(xml: string, sharedStrings: string[]) {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(document.getElementsByTagNameNS(NS, "row")).map((row) => readRow(row, sharedStrings));
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

function valueAt(index: number, row: string[]) {
  return index >= 0 ? row[index] : "";
}

function clean(value?: string) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function formatTypology(value: string) {
  return `Tipo ${value.replace(/^tipo\s*/i, "").toUpperCase()}`;
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
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/^lista[_ -]?unidades[_ -]?/i, "")
    .replace(/[_ -]+\d+(?:[._-]\d+)*$/, "")
    .trim();
  return base ? base.replace(/[_-]+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) : "Empreendimento sem nome";
}

function inferRegistration(fileName: string) {
  const normalized = fileName.replace(/\s*\(\d+\)(?=\.[^.]+$)/, "");
  return normalized.match(/(?:^|[_ -])(\d{2,}(?:[._-]\d+)+)(?:\.[^.]+$)/)?.[1]?.replace(/-/g, ".");
}
