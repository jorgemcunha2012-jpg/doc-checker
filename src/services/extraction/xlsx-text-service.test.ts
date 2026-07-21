import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractXlsxText } from "./xlsx-text-service";

test("preserva cabeçalhos e valores de todas as abas de uma planilha", async () => {
  const zip = new JSZip();
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Torre</t></si><si><t>Unidade</t></si><si><t>01</t></si><si><t>101</t></si><si><t>CPF</t></si><si><t>123.456.789-00</t></si></sst>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row></sheetData></worksheet>`);
  zip.file("xl/worksheets/sheet2.xml", `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>4</v></c></row><row r="2"><c r="A2" t="s"><v>5</v></c></row></sheetData></worksheet>`);

  const text = await extractXlsxText(await zip.generateAsync({ type: "nodebuffer" }));
  assert.match(text, /sheet1:\nTorre: 01 \| Unidade: 101/);
  assert.match(text, /sheet2:\nCPF: 123\.456\.789-00/);
});
