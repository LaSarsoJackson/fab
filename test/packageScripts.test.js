import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));

const expectBunScriptUsesPureTestFiles = (script) => {
  expect(script).toContain("find src test -type f -name '*.test.js' -print0");
  expect(script).toContain("xargs -0 bun test");
  expect(script).not.toContain("rg --files");
  expect(script).not.toContain("bun test --coverage src test");
  expect(script).not.toContain("bun test --watch src test");
};

describe("package test scripts", () => {
  test("keeps release metadata in the default cross-cutting check gate", () => {
    expect(scripts["release:check"]).toBe("bun run scripts/check-release-metadata.js");
    expect(scripts["pr:check"]).toBe("bun run scripts/check-pr-branch.js");
    expect(scripts.check).toContain("bun run release:check");
  });

  test("keeps the default Bun runner on pure JavaScript test files without ripgrep", () => {
    expectBunScriptUsesPureTestFiles(scripts["test:bun"]);
  });

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
