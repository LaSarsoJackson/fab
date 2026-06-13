#!/usr/bin/env bun

import { pathToFileURL } from "node:url";

const PIPELINE_BRANCHES = new Set(["main", "staging", "dev"]);
const SHORT_LIVED_BRANCH_PREFIXES = [
  "codex/",
  "feature/",
  "fix/",
  "docs/",
  "chore/",
  "hotfix/",
  "dependabot/",
  "renovate/",
];

const BRANCH_RULES = {
  main: {
    exact: new Set(["staging"]),
    prefixes: ["hotfix/"],
    description: "staging or hotfix/",
  },
  staging: {
    exact: new Set(["dev"]),
    prefixes: ["release/", "hotfix/"],
    description: "dev, release/, or hotfix/",
  },
  dev: {
    exact: new Set([]),
    prefixes: SHORT_LIVED_BRANCH_PREFIXES,
    description: SHORT_LIVED_BRANCH_PREFIXES.join(", "),
  },
};

export const validatePullRequestBranch = ({ baseRef = "", headRef = "" }) => {
  const rule = BRANCH_RULES[baseRef];

  if (!baseRef || !headRef || !rule) {
    return [];
  }

  if (PIPELINE_BRANCHES.has(headRef) && !rule.exact.has(headRef)) {
    return [
      `Pull requests into ${baseRef} must come from ${rule.description}, not ${headRef}.`,
    ];
  }

  if (rule.exact.has(headRef)) {
    return [];
  }

  if (rule.prefixes.some((prefix) => headRef.startsWith(prefix))) {
    return [];
  }

  return [
    `Pull request branch ${headRef} into ${baseRef} must use one of: ${rule.description}.`,
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
