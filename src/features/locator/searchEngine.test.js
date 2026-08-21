import { describe, expect, test } from "bun:test";
import { normalizeSearchText, prepareSearchRows, searchPreparedRows } from "./searchEngine";

const rows = [
  { i: 1, f: "Thomas E", l: "LaMont", s: "215" },
  { i: 2, f: "Anne", l: "O'Connor", s: "12" },
  { i: 3, f: "Connor", l: "Anne", s: "12" },
];

describe("worker search engine", () => {
  test("normalizes punctuation and diacritics", () => {
    expect(normalizeSearchText("  O’Cónnor ")).toBe("o connor");
  });

  test("matches normal and surname-first names deterministically", () => {
    const result = searchPreparedRows(prepareSearchRows(rows), { query: "LaMont Thomas" });
    expect(result.rows.map((row) => row.i)).toEqual([1]);
  });

  test("supports section browse and direct record restoration", () => {
    const prepared = prepareSearchRows(rows);
    expect(searchPreparedRows(prepared, { section: "12" }).total).toBe(2);
    expect(searchPreparedRows(prepared, { recordId: "2" }).rows[0].l).toBe("O'Connor");
  });
});
