#!/usr/bin/env bun

import { pathToFileURL } from "node:url";

const PRODUCTION_BRANCHES = new Set(["main"]);
const ALLOWED_EXACT_BRANCHES = new Set(["dev", "dev-features"]);
const ALLOWED_BRANCH_PREFIXES = [
  "codex/",
  "feature/",
  "fix/",
  "docs/",
  "chore/",
  "release/",
  "hotfix/",
  "dev-features/",
  "dependabot/",
  "renovate/",
];

const allowedBranchMessage = [
  ...ALLOWED_EXACT_BRANCHES,
  ...ALLOWED_BRANCH_PREFIXES,
].join(", ");

export const validatePullRequestBranch = ({ baseRef = "", headRef = "" }) => {
  if (!baseRef || !headRef || !PRODUCTION_BRANCHES.has(baseRef)) {
    return [];
  }

  if (PRODUCTION_BRANCHES.has(headRef)) {
    return [
      `Pull requests into ${baseRef} must come from a short-lived branch, not ${headRef}.`,
    ];
  }

  if (ALLOWED_EXACT_BRANCHES.has(headRef)) {
    return [];
  }

  if (ALLOWED_BRANCH_PREFIXES.some((prefix) => headRef.startsWith(prefix))) {
    return [];
  }

  return [
    `Pull request branch ${headRef} must use one of: ${allowedBranchMessage}.`,
  ];
};

const main = () => {
  const errors = validatePullRequestBranch({
    baseRef: process.env.GITHUB_BASE_REF,
    headRef: process.env.GITHUB_HEAD_REF,
  });

  if (!process.env.GITHUB_BASE_REF || !process.env.GITHUB_HEAD_REF) {
    console.log("No pull request branch context detected; branch policy skipped.");
    return;
  }

  if (errors.length > 0) {
    console.error("Pull request branch policy failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Pull request branch policy passed.");
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
