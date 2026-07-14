import mammoth from "mammoth";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

export async function extractDocxText(buffer: Buffer) {
  try {
    const structured = await extractStructuredDocxText(buffer);
    if (structured.length >= 20) return structured;
  } catch {
    // Some Word-compatible files have nonstandard XML; Mammoth remains the safe fallback.
  }

  const fallback = await mammoth.extractRawText({ buffer });
  return compactText(fallback.value);
}

/** Extracts readable text from common RTF files without a native office runtime. */
export function extractRtfText(buffer: Buffer) {
  const input = buffer.toString("latin1");
  if (!/^\s*\{\\rtf/i.test(input)) throw new Error("Arquivo RTF inválido ou corrompido.");

  const output: string[] = [];
  const skipDestinations = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "footer", "filetbl"]);
  const stack: Array<{ skip: boolean; uc: number }> = [];
  let skip = false;
  let unicodeFallbackCount = 1;
  let index = 0;

  while (index < input.length) {
    const character = input[index];
    if (character === "{") {
      stack.push({ skip, uc: unicodeFallbackCount });
      index += 1;
      continue;
    }
    if (character === "}") {
      const state = stack.pop();
      skip = state?.skip ?? false;
      unicodeFallbackCount = state?.uc ?? 1;
      index += 1;
      continue;
    }
    if (character !== "\\") {
      if (!skip) output.push(character);
      index += 1;
      continue;
    }

    index += 1;
    if (index >= input.length) break;
    const control = input[index];
    if (control === "\\" || control === "{" || control === "}") {
      if (!skip) output.push(control);
      index += 1;
      continue;
    }
    if (control === "\'") {
      const hex = input.slice(index + 1, index + 3);
      if (/^[0-9a-f]{2}$/i.test(hex) && !skip) output.push(Buffer.from(hex, "hex").toString("latin1"));
      index += 3;
      continue;
    }

    const wordStart = index;
    while (index < input.length && /[a-z]/i.test(input[index])) index += 1;
    const word = input.slice(wordStart, index).toLowerCase();
    let sign = 1;
    if (input[index] === "-") {
      sign = -1;
      index += 1;
    }
    const numberStart = index;
    while (index < input.length && /\d/.test(input[index])) index += 1;
    const parameter = numberStart === index ? undefined : sign * Number(input.slice(numberStart, index));
    if (input[index] === " ") index += 1;

    if (word === "*" || skipDestinations.has(word)) {
      skip = true;
    } else if (word === "uc" && parameter !== undefined) {
      unicodeFallbackCount = Math.max(0, parameter);
    } else if (word === "u" && parameter !== undefined) {
      if (!skip) output.push(String.fromCharCode(parameter < 0 ? parameter + 65536 : parameter));
      index = skipRtfFallback(input, index, unicodeFallbackCount);
    } else if (!skip && (word === "par" || word === "line" || word === "row")) {
      output.push("\n");
    } else if (!skip && word === "tab") {
      output.push("\t");
    }
  }

  const text = compactText(output.join("").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n"));
  if (!text) throw new Error("Arquivo RTF sem texto extraível.");
  return text;
}

function skipRtfFallback(input: string, start: number, count: number) {
  let index = start;
  let remaining = count;
  while (index < input.length && remaining > 0) {
    if (input[index] === "\\" && input[index + 1] === "\'") index += 3;
    else index += 1;
    remaining -= 1;
  }
  return index;
}

export async function extractStructuredDocxText(buffer: Buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const documentFile = archive.file("word/document.xml");
  if (!documentFile) throw new Error("Documento Word sem XML principal.");
  const xml = await documentFile.async("string");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const body = descendants(document, "body")[0];
  if (!body) throw new Error("Documento Word sem corpo.");

  const blocks: string[] = [];
  for (let index = 0; index < body.childNodes.length; index += 1) {
    const node = body.childNodes[index];
    if (node.nodeType !== 1) continue;
    if (nodeLocalName(node) === "p") {
      const text = paragraphText(node);
      if (text) blocks.push(text);
    }
    if (nodeLocalName(node) === "tbl") {
      blocks.push(...tableRows(node));
    }
  }
  return compactText(blocks.join("\n\n"));
}

function tableRows(table: Node) {
  return directChildren(table, "tr").flatMap((row) => {
    const cells = directChildren(row, "tc").map((cell) =>
      descendants(cell, "p").map(paragraphText).filter(Boolean),
    );
    const lineCount = Math.max(0, ...cells.map((cell) => cell.length));
    return Array.from({ length: lineCount }, (_, index) =>
      cells.map((cell) => cell[index]).filter(Boolean).join(" | "),
    ).filter(Boolean);
  });
}

function paragraphText(paragraph: Node) {
  const parts: string[] = [];
  walk(paragraph, (node) => {
    if (nodeLocalName(node) === "t" && node.textContent) parts.push(node.textContent);
    if (nodeLocalName(node) === "tab") parts.push("\t");
    if (nodeLocalName(node) === "br") parts.push("\n");
  });
  return parts.join("").replace(/[ \t]+/g, " ").trim();
}

function directChildren(node: Node, localName: string) {
  const matches: Node[] = [];
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes[index];
    if (child.nodeType === 1 && nodeLocalName(child) === localName) matches.push(child);
  }
  return matches;
}

function descendants(node: Node, localName: string) {
  const matches: Node[] = [];
  walk(node, (child) => {
    if (nodeLocalName(child) === localName) matches.push(child);
  });
  return matches;
}

function walk(node: Node, visitor: (node: Node) => void) {
  if (!node.childNodes) return;
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes[index];
    visitor(child);
    walk(child, visitor);
  }
}

function nodeLocalName(node: Node) {
  return node.nodeName.split(":").at(-1);
}

function compactText(value: string) {
  return value.replace(/\n{3,}/g, "\n\n").trim();
}
