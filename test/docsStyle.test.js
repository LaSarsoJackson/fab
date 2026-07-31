import { describe, expect, test } from "bun:test";

import { analyzeMarkdown } from "../scripts/check-docs-ste.js";

describe("documentation STE check", () => {
  test("accepts short STE prose and ignores code", () => {
    const markdown = [
      "Use the command.",
      "",
      "`This isn't checked.`",
      "",
      "```text",
      "This shouldn't be checked; it is code.",
      "```",
    ].join("\n");

    expect(analyzeMarkdown(markdown)).toEqual([]);
  });

  test("reports disallowed punctuation and words", () => {
    const errors = analyzeMarkdown("This is unclear; you shouldn't utilize it.");

    expect(errors.map(({ message }) => message)).toEqual([
      "Do not use a semicolon.",
      "Do not use a negative contraction.",
      "Use a form of use instead of utilize.",
      "Put a clear noun after this.",
    ]);
  });

  test("reports long sentences and paragraphs", () => {
    const longListItem = `- ${Array.from({ length: 21 }, () => "word").join(" ")}.`;
    const longParagraph = Array.from({ length: 7 }, (_, index) => `Sentence ${index + 1}.`).join(" ");
    const errors = analyzeMarkdown(`${longListItem}\n\n${longParagraph}`);

    expect(errors.map(({ message }) => message)).toEqual([
      "Sentence has 21 words. The limit is 20.",
      "Use no more than 6 sentences in one paragraph.",
    ]);
  });

  test("checks wrapped list prose and nested list items", () => {
    const markdown = [
      "- Keep the first line short.",
      "  This continuation shouldn't use a contraction.",
      "  - This nested item should use a direct requirement.",
    ].join("\n");
    const errors = analyzeMarkdown(markdown);

    expect(errors.map(({ message }) => message)).toEqual([
      "Do not use a negative contraction.",
      "Use must, can, or a direct instruction instead of should or shall.",
    ]);
  });

  test("reports selected non-STE word choices", () => {
    const errors = analyzeMarkdown(
      "Ensure that changes are appropriate within this file and avoid aliases."
    );

    expect(errors.map(({ message }) => message)).toEqual([
      "Use prevent or a direct negative instruction instead of avoid.",
      "Use make sure that instead of ensure.",
      "Use applicable or correct instead of appropriate.",
      "Use in, not more than, or less than instead of within.",
    ]);
  });
});
