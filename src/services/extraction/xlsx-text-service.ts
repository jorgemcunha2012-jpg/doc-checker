import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const MAX_ROWS_PER_SHEET = 2_000;
const MAX_TEXT_LENGTH = 500_000;

/**
 * Converts a workbook into labelled rows so the normal document extraction
 * pipeline can use spreadsheet fields without treating values as unlabelled
 * numbers. Every non-empty worksheet is included.
 */
export async function extractXlsxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const sheets = Object.keys(zip.files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort();
  const blocks: string[] = [];

  for (const path of sheets) {
    const file = zip.file(path);
    if (!file) continue;
    const rows = readRows(await file.async("text"), sharedStrings).filter((row) => row.some(Boolean));
    if (!rows.length) continue;
    const headers = rows[0].map(clean);
    const dataRows = rows.slice(1, MAX_ROWS_PER_SHEET + 1);
    const lines = dataRows.map((row) => row
      .map((value, index) => {
        const label = headers[index] || `Coluna ${index + 1}`;
        return value ? `${label}: ${value}` : "";
      })
      .filter(Boolean)
      .join(" | "))
      .filter(Boolean);
    if (lines.length) blocks.push(`${path.replace(/^.*\//, "").replace(/\.xml$/, "")}:\n${lines.join("\n")}`);
  }

  const text = blocks.join("\n\n").slice(0, MAX_TEXT_LENGTH).trim();
  if (!text) throw new Error("Planilha sem células legíveis para extração.");
  return text;
}

export function isXlsxName(name: string) {
  return name.toLowerCase().endsWith(".xlsx");
}

async function readSharedStrings(zip: JSZip) {
  const file = zip.file("xl/sharedStrings.xml");
  if (!file) return [];
  const document = new DOMParser().parseFromString(await file.async("text"), "text/xml");
  return Array.from(document.getElementsByTagNameNS(NS, "si")).map((item) =>
    Array.from(item.getElementsByTagNameNS(NS, "t")).map((node) => node.textContent ?? "").join(""),
  );
}

function readRows(xml: string, sharedStrings: string[]) {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(document.getElementsByTagNameNS(NS, "row")).map((row) => {
    const values: string[] = [];
    for (const cell of Array.from(row.getElementsByTagNameNS(NS, "c"))) {
      const reference = cell.getAttribute("r") ?? "";
      const column = reference.match(/[A-Z]+/)?.[0] ?? "";
      const index = columnToIndex(column);
      const valueNode = cell.getElementsByTagNameNS(NS, "v")[0];
      const inlineNode = cell.getElementsByTagNameNS(NS, "t")[0];
      let value = valueNode?.textContent ?? inlineNode?.textContent ?? "";
      if (cell.getAttribute("t") === "s" && value) value = sharedStrings[Number(value)] ?? "";
      values[index] = clean(value);
    }
    return values;
  });
}

function columnToIndex(value: string) {
  return [...value].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
