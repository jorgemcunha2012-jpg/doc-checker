import assert from "node:assert/strict";
import test from "node:test";
import { extractPageFormText } from "./pdf-text-service";

test("inclui campos preenchíveis do PDF no texto extraído", async () => {
  const page = {
    async getAnnotations() {
      return [
        { subtype: "Widget", fieldName: "Texto1", fieldValue: "FRANCISCO JOSE MARQUES DOS SANTOS28780619851" },
        { subtype: "Widget", fieldName: "VALOR TOTAL DECLARADO", fieldValue: "350.000,00" },
        { subtype: "Widget", fieldName: "Contribuinte", fieldValue: "Off" },
        { subtype: "Link", fieldName: "Ignorar", fieldValue: "x" },
      ];
    },
  };

  const text = await extractPageFormText(page);

  assert.match(text, /Texto1: FRANCISCO JOSE MARQUES DOS SANTOS28780619851/);
  assert.match(text, /VALOR TOTAL DECLARADO: 350\.000,00/);
  assert.doesNotMatch(text, /Contribuinte: Off/);
});
