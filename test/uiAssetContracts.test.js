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
});
