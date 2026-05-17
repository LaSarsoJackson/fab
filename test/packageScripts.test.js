import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));

const expectBunScriptUsesPureTestFiles = (script) => {
  expect(script).toContain("rg --files src test -g '*.test.js'");
  expect(script).not.toContain("bun test --coverage src test");
  expect(script).not.toContain("bun test --watch src test");
};

describe("package test scripts", () => {
  test("keeps watch mode from routing JSX DOM tests through Bun", () => {
    expectBunScriptUsesPureTestFiles(scripts["test:watch"]);
    expect(scripts["test:watch"]).toContain("bun test --watch");
  });

  test("keeps coverage split between Bun tests and Jest DOM tests", () => {
    expectBunScriptUsesPureTestFiles(scripts["test:coverage"]);
    expect(scripts["test:coverage"]).toContain("bun test --coverage");
    expect(scripts["test:coverage"]).toContain(
      "node_modules/.bin/jest --config ./jest.dom.config.cjs --runInBand --coverage"
    );
  });
});
