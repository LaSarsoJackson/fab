import { describe, expect, test } from "bun:test";

import { buildPublicAssetUrl } from "../src/shared/runtime/runtimeEnv";

describe("buildPublicAssetUrl", () => {
  test("prefixes asset paths with the configured public url", () => {
    expect(buildPublicAssetUrl("/data/Search_Burials.json", "/fab")).toBe(
      "/fab/data/Search_Burials.json"
    );
  });

  test("normalizes missing leading slashes", () => {
    expect(buildPublicAssetUrl("service-worker.js", "/fab")).toBe(
      "/fab/service-worker.js"
    );
  });

  test("falls back to root-relative asset urls when public url is empty", () => {
    expect(buildPublicAssetUrl("/data/site_twin/manifest.json", "")).toBe(
      "/data/site_twin/manifest.json"
    );
  });
});
