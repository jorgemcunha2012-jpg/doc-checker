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
