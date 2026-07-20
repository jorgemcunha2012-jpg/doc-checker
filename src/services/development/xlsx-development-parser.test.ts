import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractDevelopmentFromXlsx } from "./xlsx-development-parser";

test("extrai planilha XLSX com colunas de unidades e áreas", async () => {
  const zip = new JSZip();
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Torre</t></si><si><t>Unidade</t></si><si><t>Tipo</t></si><si><t>Área Privativa</t></si><si><t>Área Total</t></si><si><t>Fração Ideal</t></si><si><t>01</t></si><si><t>D</t></si></sst>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c></row><row r="2"><c r="A2" t="s"><v>6</v></c><c r="B2"><v>101</v></c><c r="C2" t="s"><v>7</v></c><c r="D2"><v>56.54</v></c><c r="E2"><v>81.801906</v></c><c r="F2"><v>0.002022647</v></c></row></sheetData></worksheet>`);

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
    evidence: { rawText: "Linha 2: 01 | 101 | D | 56.54 | 81.801906 | 0.002022647" },
  });
});
