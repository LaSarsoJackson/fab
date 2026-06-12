import { describe, expect, test } from "bun:test";

import {
  validateReleaseMetadata,
} from "../scripts/check-release-metadata.js";

const validChangelog = `
# Changelog

## [Unreleased]

## [1.2.3] - 2026-06-12

- Added release checks.
`;

describe("release metadata checks", () => {
  test("accepts a SemVer package version with a matching changelog entry", () => {
    expect(validateReleaseMetadata({
      packageJson: { version: "1.2.3" },
      changelog: validChangelog,
    })).toEqual([]);
  });

  test("rejects package versions that are not SemVer", () => {
    expect(validateReleaseMetadata({
      packageJson: { version: "summer-2026" },
      changelog: validChangelog,
    })).toEqual([
      "package.json version must use SemVer, for example 1.2.3.",
    ]);
  });

  test("rejects a package version that is missing from the changelog", () => {
    expect(validateReleaseMetadata({
      packageJson: { version: "1.2.4" },
      changelog: validChangelog,
    })).toEqual([
      "CHANGELOG.md must include a release section for version 1.2.4.",
    ]);
  });

  test("rejects release tags that do not match the package version", () => {
    expect(validateReleaseMetadata({
      packageJson: { version: "1.2.3" },
      changelog: validChangelog,
      releaseTag: "v1.2.4",
    })).toEqual([
      "Release tag v1.2.4 must match package.json version 1.2.3.",
    ]);
  });
});
