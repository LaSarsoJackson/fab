import { readFileSync } from "fs";
import { describe, expect, test } from "bun:test";
import { resolveArceBiographyUrl } from "../src/features/fab/arceLinks";
import { FAB_TOUR_DEFINITIONS } from "../src/features/fab/tours";
import { BOUNDARY_BBOX } from "../src/features/map/generatedBounds";
import { CEMETERY_VIEW } from "../src/features/map/mapStyle";

describe("FAB product contract", () => {
  test("keeps one direct tour registry and one cemetery view", () => {
    expect(FAB_TOUR_DEFINITIONS.length).toBeGreaterThan(10);
    expect(new Set(FAB_TOUR_DEFINITIONS.map(({ key }) => key)).size).toBe(FAB_TOUR_DEFINITIONS.length);
    expect(CEMETERY_VIEW.bounds).toEqual(BOUNDARY_BBOX);
  });

  test("allows only ARCE biography pages", () => {
    expect(resolveArceBiographyUrl("Schuyler70")).toBe("https://www.albany.edu/arce/Schuyler70.html");
    expect(resolveArceBiographyUrl("https://example.com/Schuyler70.html")).toBe("");
    expect(resolveArceBiographyUrl("javascript:alert(1)")).toBe("");
  });

  test("keeps the large search payload out of the service-worker cache", () => {
    const serviceWorker = readFileSync(new URL("../public/service-worker.js", import.meta.url), "utf8");
    expect(serviceWorker).toContain("url.pathname.endsWith(SEARCH_DATA_PATH)");
  });
});
