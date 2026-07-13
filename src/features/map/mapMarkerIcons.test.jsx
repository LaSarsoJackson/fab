/** @jest-environment jsdom */

import {
  MAP_MARKER_COLORS,
  createCemeteryClusterIcon,
  createSelectedLocationIcon,
  getSectionAffordanceIcon,
  getSectionClusterIcon,
  getSectionPoiIcon,
} from "./mapMarkerIcons";

describe("MAP_MARKER_COLORS", () => {
  test("exposes a stable palette of hex colors", () => {
    expect(MAP_MARKER_COLORS).toHaveLength(6);
    MAP_MARKER_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe("createCemeteryClusterIcon", () => {
  test("scales the badge with the cluster count", () => {
    expect(createCemeteryClusterIcon({ count: 0 }).options.iconSize).toEqual([30, 30]);
    expect(createCemeteryClusterIcon({ count: 3 }).options.iconSize).toEqual([31, 31]);
    expect(createCemeteryClusterIcon({ count: 6 }).options.iconSize).toEqual([32, 32]);
    expect(createCemeteryClusterIcon({ count: 10 }).options.iconSize).toEqual([34, 34]);
    expect(createCemeteryClusterIcon({ count: 20 }).options.iconSize).toEqual([37, 37]);
    expect(createCemeteryClusterIcon({ count: 50 }).options.iconSize).toEqual([40, 40]);
  });

  test("lets an explicit size override the count-derived size", () => {
    expect(createCemeteryClusterIcon({ count: 50, size: 18 }).options.iconSize).toEqual([18, 18]);
  });

  test("derives a density class and accessible label from the count", () => {
    const dense = createCemeteryClusterIcon({ count: 50 });
    expect(dense.options.html).toContain("cemetery-cluster--massive");
    expect(dense.options.html).toContain('data-density-label="50 or more records"');

    const sparse = createCemeteryClusterIcon({ count: 1 });
    expect(sparse.options.html).toContain("cemetery-cluster--small");
    expect(sparse.options.html).toContain('data-density-label="1 to 2 records"');
  });

  test("escapes the rendered label to keep injected markup inert", () => {
    const icon = createCemeteryClusterIcon({ count: 2, label: '<img src=x onerror="alert(1)">' });

    expect(icon.options.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(icon.options.html).not.toContain("<img src=x");
  });

  test("defaults the visible label to the normalized count", () => {
    expect(createCemeteryClusterIcon({ count: 12 }).options.html).toContain(
      '<span class="cemetery-cluster__count">12</span>'
    );
  });
});

describe("createSelectedLocationIcon", () => {
  test("uses one selected-place marker with the people count", () => {
    const icon = createSelectedLocationIcon({ count: 58 });

    expect(icon.options.iconSize).toEqual([34, 34]);
    expect(icon.options.className).toContain("selected-location-marker-icon");
    expect(icon.options.html).toContain("selected-location-marker");
    expect(icon.options.html).toContain(">58</span>");
  });

  test("adds the highlighted modifier only when highlighted", () => {
    expect(createSelectedLocationIcon({ count: 1, isHighlighted: true }).options.html).toContain(
      "selected-location-marker--highlighted"
    );
    expect(createSelectedLocationIcon({ count: 1, isHighlighted: false }).options.html).not.toContain(
      "selected-location-marker--highlighted"
    );
  });
});

describe("getSectionPoiIcon", () => {
  test("renders an escaped section label and section sizing", () => {
    const badge = 26;
    const icon = getSectionPoiIcon({ sectionValue: "12<b>", size: badge });

    expect(icon.options.iconSize).toEqual([72, badge + 18]);
    expect(icon.options.html).toContain("Sec 12&lt;b&gt;");
    expect(icon.options.html).not.toContain("<b>");
  });

  test("omits the label when withLabel is false", () => {
    const icon = getSectionPoiIcon({ sectionValue: "12", withLabel: false });
    expect(icon.options.html).not.toContain("section-poi__label");
  });

  test("caches icons by their visual signature", () => {
    const first = getSectionPoiIcon({ sectionValue: "7", size: 26, variant: "overview" });
    const second = getSectionPoiIcon({ sectionValue: "7", size: 26, variant: "overview" });
    expect(first).toBe(second);
  });
});

describe("section affordance helpers", () => {
  test("getSectionClusterIcon renders a label-free detail marker", () => {
    const icon = getSectionClusterIcon(5);
    expect(icon.options.html).toContain("section-poi--detail");
    expect(icon.options.html).not.toContain("section-poi__label");
  });

  test("getSectionAffordanceIcon renders a label-free overview marker", () => {
    const icon = getSectionAffordanceIcon(28);
    expect(icon.options.html).toContain("section-poi--overview");
    expect(icon.options.html).not.toContain("section-poi__label");
  });
});
