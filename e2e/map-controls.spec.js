import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const observeMap = async (page) => page.route(/\/src\/features\/map\/MapView\.jsx(?:\?.*)?$/, async (route) => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace("mapRef.current = map;", "mapRef.current = map; globalThis.testMap = map;") });
});
const zoom = async (page, level) => {
  await page.evaluate((level) => globalThis.testMap.jumpTo({ center: [-73.73362, 42.70749], zoom: level }), level);
  await page.waitForFunction(() => globalThis.testMap.loaded() && !globalThis.testMap.isMoving());
};

test("Sections off remains off after zooming in", async ({ page }, testInfo) => {
  await observeMap(page);
  await page.goto("./?view=map");
  await page.waitForFunction(() => globalThis.testMap?.loaded());
  await zoom(page, 18);
  const labels = () => page.evaluate(() => globalThis.testMap.queryRenderedFeatures({ layers: ["cemetery-section-labels"] }).length);
  await testInfo.attach("sections-off-zoomed", { body: await page.screenshot(), contentType: "image/png" });
  await expect.poll(labels).toBe(0);
});

for (const viewport of [{ width: 375, height: 812 }, { width: 568, height: 320 }, { width: 1440, height: 900 }]) {
  test(`layers stay selected through zoom, navigation and reload at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await observeMap(page);
    await page.goto("./?view=map");
    const trigger = page.getByRole("button", { name: "Map layers", exact: true });
    await trigger.click();
    await page.getByRole("radio", { name: "Streets", exact: true }).check();
    await page.getByLabel("Sections", { exact: true }).check();
    await trigger.press("Escape");
    await expect(trigger).toBeFocused();
    const box = await trigger.boundingBox();
    expect(box.x).toBeGreaterThan(viewport.width / 2);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await zoom(page, 18);
    await expect.poll(() => page.evaluate(() => globalThis.testMap.queryRenderedFeatures({ layers: ["cemetery-section-labels"] }).length)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Burial Locator", exact: true }).click();
    await page.getByRole("button", { name: "Cemetery Map", exact: true }).click();
    await page.reload();
    await trigger.click();
    await expect(page.getByRole("radio", { name: "Streets", exact: true })).toBeChecked();
    await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();
    await page.getByLabel("Sections", { exact: true }).uncheck();
    await page.getByRole("radio", { name: "Terrain", exact: true }).check();
    await trigger.press("Escape");
    await zoom(page, 18);
    await expect.poll(() => page.evaluate(() => globalThis.testMap.queryRenderedFeatures({ layers: ["cemetery-section-labels", "cemetery-section-outlines"] }).length)).toBe(0);
    await testInfo.attach(`map-controls-${viewport.width}`, { body: await page.screenshot(), contentType: "image/png" });
  });
}

test("route places are searched and chosen with the keyboard", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./?view=map&tour=Notable&record=tour%3ANotable%3A18%3A24%3A8");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Cemetery directions" });
  await panel.getByRole("button", { name: /^From / }).click();
  const search = panel.getByRole("searchbox", { name: "Section or burial" });
  await search.fill("214");
  await expect(panel.getByRole("button", { name: "Section 214", exact: true })).toBeVisible();
  await search.press("Tab");
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("button", { name: /^From Section 214/ })).toBeFocused();
  await expect(panel.locator(".map-route-distance")).toBeVisible();
  await panel.getByRole("button", { name: /^To / }).click();
  await panel.getByRole("searchbox", { name: "Section or burial" }).fill("NoSuchPlaceZZZ");
  await expect(panel.locator(".map-route-places").getByRole("status")).toContainText("No places found");
  await panel.getByRole("searchbox", { name: "Section or burial" }).press("Escape");
  await expect(panel.getByRole("button", { name: /^To .*Chester/ })).toBeFocused();
  await panel.getByRole("button", { name: /^To / }).click();
  await panel.getByRole("searchbox", { name: "Section or burial" }).fill("William G Roe");
  await panel.getByRole("button", { name: "William G Roe", exact: true }).click();
  await expect(panel.getByRole("button", { name: /^To William G Roe/ })).toBeFocused();
  await expect(panel.locator(".map-route-distance")).toBeVisible();
  await testInfo.attach("route-search-mobile", { body: await page.screenshot(), contentType: "image/png" });
});

for (const width of [390, 1440]) {
  test(`Aerial loads state imagery and survives navigation and reload at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await observeMap(page);
    await page.goto("./?view=map");
    const layers = page.getByRole("button", { name: "Map layers", exact: true });
    await layers.click();
    const tile = page.waitForResponse(response => response.url().startsWith("https://orthos.its.ny.gov/") && response.ok());
    await page.getByRole("radio", { name: "Aerial", exact: true }).check();
    const response = await tile;
    expect(response.headers()["content-type"]).toContain("image/");
    expect((await response.body()).length).toBeGreaterThan(1000);
    await page.waitForFunction(() => globalThis.testMap.loaded() && !globalThis.testMap.isMoving());
    await page.getByLabel("Sections", { exact: true }).check();
    await layers.press("Escape");
    await page.getByLabel("Map credits", { exact: true }).click();
    await expect(page.getByRole("link", { name: "NYS ITS Geospatial Services", exact: true })).toBeVisible();
    await page.getByLabel("Map credits", { exact: true }).click();
    const screenshot = `../evidence/live-tutorial/aerial-${width}.png`;
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`aerial-${width}`, { path: screenshot, contentType: "image/png" });
    await page.getByRole("button", { name: "Burial Locator", exact: true }).click();
    await page.getByRole("button", { name: "Cemetery Map", exact: true }).click();
    await page.reload();
    await layers.click();
    await expect(page.getByRole("radio", { name: "Aerial", exact: true })).toBeChecked();
    await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();
  });
}

test("existing Streets preference remains Streets", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fab.map-preferences.v1", JSON.stringify({ hillshade: false, showSections: true })));
  await page.goto("./?view=map");
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Streets", exact: true })).toBeChecked();
  await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();
});
