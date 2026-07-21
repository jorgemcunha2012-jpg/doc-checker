import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractDevelopmentFromXlsx } from "./xlsx-development-parser";

test("extrai todas as colunas de unidades e áreas de uma planilha XLSX", async () => {
  const zip = spreadsheet(
    ["Torre", "Unidade", "Tipo", "Área Privativa", "Área Total", "Fração Ideal"],
    [["01", "101", "D", "56.54", "81.801906", "0.002022647"]],
  );

  const result = await extractDevelopmentFromXlsx(await zip.generateAsync({ type: "nodebuffer" }), "Lista_Unidades_Viver_Essencial_528.123.xlsx");
  assert.equal(result.name, "Viver Essencial");
  assert.equal(result.registration, "528.123");
  assert.deepEqual(result.units[0], {
    tower: "01",
    unit: "101",
    typology: "Tipo D",
    privateArea: "56,54",
    totalArea: "81,801906",
    idealFraction: "0,002022647",
    confidence: 99,
    evidence: { rawText: "sheet1, linha 2: 01 | 101 | D | 56.54 | 81.801906 | 0.002022647" },
  });
});

test("encontra cabeçalho fora da primeira linha e reconhece bloco e apartamento", async () => {
  const zip = spreadsheet(
    ["Bloco", "Apartamento", "Tipologia", "Área Exclusiva", "Área de Uso Comum", "Inscrição Imobiliária"],
    [["B", "1204", "Garden", "71,25", "15,75", "1234567"]],
    ["Relatório de unidades", "Atualizado em 21/07/2026"],
  );

  const result = await extractDevelopmentFromXlsx(await zip.generateAsync({ type: "nodebuffer" }), "Cadastro.xlsx");
  assert.deepEqual(result.units[0], {
    tower: "B",
    unit: "1204",
    typology: "Tipo GARDEN",
    privateArea: "71,25",
    commonArea: "15,75",
    iptuRegistration: "1234567",
    confidence: 99,
    evidence: { rawText: "sheet1, linha 4: B | 1204 | Garden | 71,25 | 15,75 | 1234567" },
  });
});

test("mantém torre, unidade e áreas quando o arquivo não possui tipo", async () => {
  const zip = spreadsheet(
    ["Bloco", "Unid.", "Área Privativa", "Área Total"],
    [["03", "1402", "37,96", "62,043127"]],
  );

  const result = await extractDevelopmentFromXlsx(await zip.generateAsync({ type: "nodebuffer" }), "Unidades.xlsx");
  assert.equal(result.units.length, 1);
  assert.equal(result.units[0]?.tower, "03");
  assert.equal(result.units[0]?.unit, "1402");
  assert.equal(result.units[0]?.typology, "");
  assert.match(result.quality?.warnings.join(" ") ?? "", /tipo/i);
});

function spreadsheet(headers: string[], data: string[][], leadingRows: string[] = []) {
  const zip = new JSZip();
  const strings = [...leadingRows, ...headers, ...data.flat()];
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`);
  const rows = [...leadingRows.map((value) => [value]), headers, ...data];
  let offset = 0;
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${column(columnIndex)}${rowIndex + 1}" t="s"><v>${offset++}</v></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`);
  return zip;
}

function column(index: number) {
  return String.fromCharCode(65 + index);
}
