import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("long-lived branch promotion contract", () => {
  test("preserves ancestry when promoting dev to staging", () => {
    const workflow = readFileSync(
      ".github/workflows/promote-dev-to-staging.yml",
      "utf8"
    );

    expect(workflow).toContain("--merge");
    expect(workflow).not.toContain("--squash");
    expect(workflow).not.toContain("--rebase");
  });
});
