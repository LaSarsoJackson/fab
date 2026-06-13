import { describe, expect, test } from "bun:test";

import {
  validatePullRequestBranch,
} from "../scripts/check-pr-branch.js";

describe("pull request branch policy", () => {
  test("allows prefixed feature branches into the development branch", () => {
    expect(validatePullRequestBranch({
      baseRef: "dev",
      headRef: "codex/release-pipeline",
    })).toEqual([]);
  });

  test("rejects unprefixed work branches into the development branch", () => {
    expect(validatePullRequestBranch({
      baseRef: "dev",
      headRef: "quick-change",
    })).toEqual([
      "Pull request branch quick-change into dev must use one of: codex/, feature/, fix/, docs/, chore/, hotfix/, dependabot/, renovate/.",
    ]);
  });

  test("allows the integration branch into staging", () => {
    expect(validatePullRequestBranch({
      baseRef: "staging",
      headRef: "dev",
    })).toEqual([]);
  });

  test("allows release and hotfix branches into staging", () => {
    expect(validatePullRequestBranch({
      baseRef: "staging",
      headRef: "release/1.2.3",
    })).toEqual([]);
    expect(validatePullRequestBranch({
      baseRef: "staging",
      headRef: "hotfix/pages-routing",
    })).toEqual([]);
  });

  test("allows staging into production", () => {
    expect(validatePullRequestBranch({
      baseRef: "main",
      headRef: "staging",
    })).toEqual([]);
  });

  test("allows emergency hotfix branches into production", () => {
    expect(validatePullRequestBranch({
      baseRef: "main",
      headRef: "hotfix/pages-routing",
    })).toEqual([]);
  });

  test("rejects direct production branch pull requests", () => {
    expect(validatePullRequestBranch({
      baseRef: "main",
      headRef: "main",
    })).toEqual([
      "Pull requests into main must come from staging or hotfix/, not main.",
    ]);
  });

  test("rejects integration branches directly into production", () => {
    expect(validatePullRequestBranch({
      baseRef: "main",
      headRef: "dev",
    })).toEqual([
      "Pull requests into main must come from staging or hotfix/, not dev.",
    ]);
  });

  test("rejects unprefixed work branches into production", () => {
    expect(validatePullRequestBranch({
      baseRef: "main",
      headRef: "quick-change",
    })).toEqual([
      "Pull request branch quick-change into main must use one of: staging or hotfix/.",
    ]);
  });

  test("skips branch policy outside managed pipeline pull requests", () => {
    expect(validatePullRequestBranch({
      baseRef: "sandbox",
      headRef: "codex/tooling-spike",
    })).toEqual([]);
  });
});
