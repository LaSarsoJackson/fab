#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasChangelogReleaseSection = (changelog, version) => {
  const releaseHeading = new RegExp(
    `^## \\[${escapeRegExp(version)}\\](?:\\s+-\\s+\\d{4}-\\d{2}-\\d{2})?\\s*$`,
    "m"
  );

  return releaseHeading.test(changelog);
};

export const validateReleaseMetadata = ({
  packageJson,
  changelog,
  releaseTag = "",
}) => {
  const errors = [];
  const version = packageJson?.version;

  if (typeof version !== "string" || !SEMVER_PATTERN.test(version)) {
    errors.push("package.json version must use SemVer, for example 1.2.3.");
    return errors;
  }

  if (!/^## \[Unreleased\]\s*$/m.test(changelog || "")) {
    errors.push("CHANGELOG.md must include a ## [Unreleased] section.");
  }

  if (!hasChangelogReleaseSection(changelog || "", version)) {
    errors.push(`CHANGELOG.md must include a release section for version ${version}.`);
  }

  const normalizedReleaseTag = String(releaseTag || "").trim();
  if (normalizedReleaseTag && normalizedReleaseTag !== `v${version}`) {
    errors.push(`Release tag ${normalizedReleaseTag} must match package.json version ${version}.`);
  }

  return errors;
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const currentReleaseTag = () => {
  if (process.env.GITHUB_REF_TYPE === "tag") {
    return process.env.GITHUB_REF_NAME || "";
  }

  return "";
};

const main = () => {
  const rootDir = resolve(import.meta.dirname, "..");
  const errors = validateReleaseMetadata({
    packageJson: readJson(resolve(rootDir, "package.json")),
    changelog: readFileSync(resolve(rootDir, "CHANGELOG.md"), "utf8"),
    releaseTag: currentReleaseTag(),
  });

  if (errors.length > 0) {
    console.error("Release metadata check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Release metadata check passed.");
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
