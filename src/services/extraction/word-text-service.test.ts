import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { extractStructuredDocxText } from "./word-text-service";

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
