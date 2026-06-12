import { describe, expect, test } from "bun:test";

import {
  validatePullRequestBranch,
} from "../scripts/check-pr-branch.js";

describe("pull request branch policy", () => {
  test("allows prefixed feature branches into the production branch", () => {
    expect(validatePullRequestBranch({
      baseRef: "master",
      headRef: "codex/release-pipeline",
    })).toEqual([]);
  });

  test("allows the dev-features promotion branch into the production branch", () => {
    expect(validatePullRequestBranch({
      baseRef: "master",
      headRef: "dev-features",
    })).toEqual([]);
  });

  test("rejects direct production-branch pull requests", () => {
    expect(validatePullRequestBranch({
      baseRef: "master",
      headRef: "master",
    })).toEqual([
      "Pull requests into master must come from a short-lived branch, not master.",
    ]);
  });

  test("rejects unprefixed work branches into the production branch", () => {
    expect(validatePullRequestBranch({
      baseRef: "main",
      headRef: "quick-change",
    })).toEqual([
      "Pull request branch quick-change must use one of: dev-features, codex/, feature/, fix/, docs/, chore/, release/, hotfix/, dev-features/, dependabot/, renovate/.",
    ]);
  });

  test("skips branch policy outside production pull requests", () => {
    expect(validatePullRequestBranch({
      baseRef: "dev-features",
      headRef: "codex/tooling-spike",
    })).toEqual([]);
  });
});
