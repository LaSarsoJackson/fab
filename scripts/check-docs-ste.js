#!/usr/bin/env bun

import { readdirSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_DESCRIPTIVE_WORDS = 25;
const MAX_LIST_WORDS = 20;
const MAX_PARAGRAPH_SENTENCES = 6;

const PROSE_ROOTS = [".github", "docs"];
const ROOT_DOCUMENTS = ["AGENTS.md", "CHANGELOG.md", "CONTRIBUTING.md", "README.md"];

const DISALLOWED_PATTERNS = [
  {
    pattern: /;/u,
    message: "Do not use a semicolon.",
  },
  {
    pattern: /\b(?:aren|can|couldn|didn|doesn|don|hadn|hasn|haven|isn|mustn|shouldn|wasn|weren|won|wouldn)[’']t\b/iu,
    message: "Do not use a negative contraction.",
  },
  {
    pattern: /\b(?:here|how|it|that|there|they|we|what|when|where|who|why|you)[’'](?:d|ll|re|s|ve)\b/iu,
    message: "Do not use a contraction.",
  },
  {
    pattern: /\b(?:should|shall)\b/iu,
    message: "Use must, can, or a direct instruction instead of should or shall.",
  },
  {
    pattern: /\b(?:e\.g\.|i\.e\.|etc\.)/iu,
    message: "Do not use a Latin abbreviation. Write the meaning in full.",
  },
  {
    pattern: /\bin order to\b/iu,
    message: "Use to instead of in order to.",
  },
  {
    pattern: /\bprior to\b/iu,
    message: "Use before instead of prior to.",
  },
  {
    pattern: /\butiliz(?:e|es|ed|ing)\b/iu,
    message: "Use a form of use instead of utilize.",
  },
  {
    pattern: /\bperform(?:s|ed|ing)?\b/iu,
    message: "Use do or a specific technical verb instead of perform.",
  },
  {
    pattern: /\bavoid(?:s|ed|ing)?\b/iu,
    message: "Use prevent or a direct negative instruction instead of avoid.",
  },
  {
    pattern: /\bensure(?:s|d|ing)?\b/iu,
    message: "Use make sure that instead of ensure.",
  },
  {
    pattern: /\ballow(?:s|ed|ing)?\b/iu,
    message: "Use permit, can, or accept instead of allow.",
  },
  {
    pattern: /\bappropriate\b/iu,
    message: "Use applicable or correct instead of appropriate.",
  },
  {
    pattern: /\bvia\b/iu,
    message: "Use through or with instead of via.",
  },
  {
    pattern: /\bwithin\b/iu,
    message: "Use in, not more than, or less than instead of within.",
  },
  {
    pattern: /\bcurrently\b/iu,
    message: "Use now or a direct time statement instead of currently.",
  },
  {
    pattern: /\b[Tt]his\s+(?:is|was|will|can|must|has|does|keeps|makes|lets)\b/u,
    message: "Put a clear noun after this.",
  },
];

const listMarkdownFiles = (directory) => {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(entryPath));
    } else if (extname(entry.name).toLowerCase() === ".md") {
      files.push(entryPath);
    }
  }

  return files;
};

const stripInlineMarkup = (value) => value
  .replace(/!\[[^\]]*\]\([^)]*\)/gu, " IMAGE ")
  .replace(/\[[^\]]+\]\([^)]*\)/gu, " TERM ")
  .replace(/`[^`]*`/gu, " TERM ")
  .replace(/https?:\/\/\S+/gu, " TERM ")
  .replace(/<[^>]+>/gu, " ")
  .replace(/[>*_~]/gu, " ")
  .replace(/\s+/gu, " ")
  .trim();

const countWords = (value) => (
  value.match(/[\p{L}\p{N}]+(?:[’'/-][\p{L}\p{N}]+)*/gu) || []
).length;

const splitSentences = (value) => value
  .replace(/…/gu, ".")
  .split(/(?<=[.!?])["')\]]*\s+/u)
  .map((sentence) => sentence.trim())
  .filter(Boolean);

const makeBlocks = (markdown) => {
  const blocks = [];
  const lines = markdown.split(/\r?\n/u);
  let block = null;
  let fence = null;
  let inHtmlComment = false;

  const flush = () => {
    if (block?.lines.length) {
      blocks.push(block);
    }
    block = null;
  };

  const addBlock = (lineNumber, kind, text) => {
    block = { lineNumber, kind, lines: [text] };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(```+|~~~+)/u);

    if (fenceMatch) {
      flush();
      fence = fence ? null : fenceMatch[1][0];
      continue;
    }
    if (fence) {
      continue;
    }

    if (line.includes("<!--")) {
      inHtmlComment = true;
    }
    if (inHtmlComment) {
      if (line.includes("-->")) {
        inHtmlComment = false;
      }
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*#{1,6}\s+/u.test(line) || /^\s*(?:---+|===+)\s*$/u.test(line)) {
      flush();
      addBlock(lineNumber, "heading", line.replace(/^\s*#{1,6}\s+/u, ""));
      flush();
      continue;
    }
    if (/^\s*\|/u.test(line)) {
      flush();
      if (!/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/u.test(line)) {
        for (const cell of line.split("|").map((value) => value.trim()).filter(Boolean)) {
          blocks.push({ lineNumber, kind: "table", lines: [cell] });
        }
      }
      continue;
    }

    const listMatch = line.match(/^\s*(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.*)$/u);
    if (listMatch) {
      flush();
      addBlock(lineNumber, "list", listMatch[1]);
      continue;
    }
    if (/^\s{4,}\S/u.test(line)) {
      if (block?.kind === "list") {
        block.lines.push(line.trim());
      } else {
        flush();
      }
      continue;
    }

    const text = line.replace(/^\s*>\s?/u, "").trim();
    if (!block) {
      addBlock(lineNumber, "paragraph", text);
    } else {
      block.lines.push(text);
    }
  }

  flush();
  return blocks;
};

export const analyzeMarkdown = (markdown, filePath = "document.md") => {
  const errors = [];

  for (const block of makeBlocks(markdown)) {
    const text = stripInlineMarkup(block.lines.join(" "));
    if (!text) {
      continue;
    }

    for (const { pattern, message } of DISALLOWED_PATTERNS) {
      if (pattern.test(text)) {
        errors.push({ filePath, lineNumber: block.lineNumber, message });
      }
    }

    if (block.kind === "heading") {
      continue;
    }

    const sentences = splitSentences(text);
    if (block.kind === "paragraph" && sentences.length > MAX_PARAGRAPH_SENTENCES) {
      errors.push({
        filePath,
        lineNumber: block.lineNumber,
        message: `Use no more than ${MAX_PARAGRAPH_SENTENCES} sentences in one paragraph.`,
      });
    }

    const wordLimit = block.kind === "list" ? MAX_LIST_WORDS : MAX_DESCRIPTIVE_WORDS;
    for (const sentence of sentences) {
      const wordCount = countWords(sentence);
      if (wordCount > wordLimit) {
        errors.push({
          filePath,
          lineNumber: block.lineNumber,
          message: `Sentence has ${wordCount} words. The limit is ${wordLimit}.`,
        });
      }
    }
  }

  return errors;
};

const main = () => {
  const rootDir = resolve(import.meta.dirname, "..");
  const files = [
    ...ROOT_DOCUMENTS.map((filePath) => resolve(rootDir, filePath)),
    ...PROSE_ROOTS.flatMap((directory) => listMarkdownFiles(resolve(rootDir, directory))),
  ].sort();
  const errors = files.flatMap((filePath) => analyzeMarkdown(
    readFileSync(filePath, "utf8"),
    filePath.slice(rootDir.length + 1)
  ));

  if (errors.length) {
    console.error("Simplified Technical English check failed:");
    for (const error of errors) {
      console.error(`${error.filePath}:${error.lineNumber}: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Simplified Technical English check passed for ${files.length} files.`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
