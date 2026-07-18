import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const readText = (path) => readFileSync(path, "utf8");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readCssBlock = (css, selector) => {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  return match?.[1] || "";
};

describe("UI asset contracts", () => {
  test("bundles Leaflet CSS locally instead of loading it from unpkg", () => {
    expect(readText("src/index.js")).toContain("import 'leaflet/dist/leaflet.css';");
    expect(readText("public/index.html")).not.toContain("unpkg.com/leaflet");
    expect(readText("public/index.template.html")).not.toContain("unpkg.com/leaflet");
  });

  test("keeps map and popup controls at the 44px touch target minimum", () => {
    const css = readText("src/index.css");
    const leafletLayerToggle = readCssBlock(css, ".leaflet-control-layers-toggle");
    const popupAction = readCssBlock(css, ".popup-card__action");
    const popupStackOption = readCssBlock(css, ".popup-card__stack-option");
    const popupCloseHitTarget = readCssBlock(css, ".leaflet-container a.leaflet-popup-close-button::after");
    const sheetHeaderButtonHitTarget = readCssBlock(css, ".mobile-sheet-header__icon-button.MuiIconButton-root::after");
    const markerToggle = readCssBlock(css, ".left-sidebar__marker-toggle.MuiButton-root");
    const quickTourButton = readCssBlock(css, ".left-sidebar__quick-tour-button.MuiButton-root");

    expect(leafletLayerToggle).toContain("width: 44px");
    expect(leafletLayerToggle).toContain("height: 44px");
    expect(popupAction).toContain("min-height: 44px");
    expect(popupStackOption).toContain("min-height: 44px");
    expect(popupCloseHitTarget).toContain("inset: -8px");
    expect(sheetHeaderButtonHitTarget).toContain("inset: -4px");
    expect(markerToggle).toContain("min-height: 44px");
    expect(quickTourButton).toContain("min-height: 44px");
  });

  test("keeps stacked popup content in one bounded scroll region", () => {
    const css = readText("src/index.css");
    const popupStack = readCssBlock(css, ".leaflet-popup .popup-card-stack");
    const stackedCard = readCssBlock(css, ".leaflet-popup .popup-card-stack > .popup-card");
    const stackedList = readCssBlock(css, ".leaflet-popup .popup-card-stack .popup-card__stack-list");

    expect(popupStack).toContain("max-height: min(70vh, 420px)");
    expect(popupStack).toContain("overflow-y: auto");
    expect(stackedCard).toContain("overflow: visible");
    expect(stackedList).toContain("overflow-x: auto");
    expect(stackedList).toContain("overflow-y: hidden");
  });

  test("uses tabular numerals for compact shared-plot counts", () => {
    const css = readText("src/index.css");
    const popupContextCount = readCssBlock(css, ".popup-card__context-count");

    expect(popupContextCount).toContain("font-variant-numeric: tabular-nums");
  });

  test("preserves safe-area insets in compact popup width", () => {
    const css = readText("src/index.css");
    const compactPopup = readCssBlock(css, ".popup-card--compact");

    expect(compactPopup).toContain(
      "max-width: min(240px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 44px))"
    );
  });

  test("keeps compact Leaflet popups in bounded scroll regions", () => {
    const css = readText("src/index.css");
    const compactPopup = readCssBlock(css, ".leaflet-popup .popup-card--compact");
    const compactStack = readCssBlock(css, ".leaflet-popup .popup-card-stack--compact");

    expect([
      compactPopup.includes("max-height: min(70vh, 420px)"),
      compactPopup.includes("overflow-y: auto"),
      compactStack.includes("max-height: min(70vh, 420px)"),
      compactStack.includes("overflow-x: hidden"),
      compactStack.includes("overflow-y: auto"),
    ]).toEqual([true, true, true, true, true]);
  });

  test("keeps secondary map controls comfortably tappable", () => {
    const css = readText("src/index.css");
    const moreButton = readCssBlock(css, ".left-sidebar__more-button.MuiButton-root");

    expect(moreButton).toContain("min-height: 40px");
  });

  test("keeps changing route measurements visually stable", () => {
    const css = readText("src/index.css");
    const routeStatusContent = readCssBlock(css, ".route-status-overlay__content");

    expect(routeStatusContent).toContain("font-variant-numeric: tabular-nums");
  });

  test("limits mobile header icon motion to the properties it changes", () => {
    const css = readText("src/index.css");
    const mobileHeaderIcon = readCssBlock(css, ".mobile-sheet-header__icon-button.MuiIconButton-root");

    expect(mobileHeaderIcon).toContain("transition-property: background-color, scale");
  });

  test("avoids broad transitions and permanent compositor hints", () => {
    const css = readText("src/index.css");

    expect(css).not.toMatch(/transition\s*:\s*all(?:\s|;)/);
    expect(css).not.toMatch(/will-change\s*:/);
  });
});
