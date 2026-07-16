import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { extractRtfText, extractStructuredDocxText } from "./word-text-service";

test("preserva a associação entre rótulos e valores em tabelas DOCX", async () => {
  const archive = new JSZip();
  archive.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Condições do financiamento</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:p><w:r><w:t>B.4.1 - Valor do financiamento:</w:t></w:r></w:p>
              <w:p><w:r><w:t>B.4.2 - Recursos próprios:</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>R$ 299.200,00</w:t></w:r></w:p>
              <w:p><w:r><w:t>R$ 88.800,00</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>`);
  const buffer = await archive.generateAsync({ type: "nodebuffer" });

  const text = await extractStructuredDocxText(buffer);

  assert.match(text, /B\.4\.1 - Valor do financiamento: \| R\$ 299\.200,00/);
  assert.match(text, /B\.4\.2 - Recursos próprios: \| R\$ 88\.800,00/);
});

test("extrai texto RTF com acentos, quebras de linha e metadados ignorados", () => {
  const rtf = String.raw`{\rtf1\ansi\ansicpg1252{\fonttbl{\f0 Arial;}}{\info{\author Interno}}\f0 Nome: Jo\'e3o da Silva\par CPF: 619.422.763-03\par Valor: R$ 150.000,00}`;

  const text = extractRtfText(Buffer.from(rtf, "latin1"));

  assert.match(text, /Nome: João da Silva/);
  assert.match(text, /CPF: 619\.422\.763-03/);
  assert.match(text, /Valor: R\$ 150\.000,00/);
  assert.doesNotMatch(text, /Interno|fonttbl/);
});

test("extrai caracteres Unicode RTF", () => {
  const rtf = String.raw`{\rtf1\ansi\uc1 Cidade: S\u227?o Paulo}`;
  assert.equal(extractRtfText(Buffer.from(rtf, "latin1")), "Cidade: São Paulo");
});

test("aceita RTF com BOM e espaços antes do cabeçalho", () => {
  const rtf = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(String.raw`  {\rtf1\ansi Nome: Jo\'e3o\par}`, "latin1"),
  ]);
  assert.equal(extractRtfText(rtf), "Nome: João");
});
