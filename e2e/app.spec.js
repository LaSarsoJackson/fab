import { expect, test } from "@playwright/test";

const APP_PORT = process.env.PLAYWRIGHT_APP_PORT || "4173";
const APP_HOSTS = new Set([`127.0.0.1:${APP_PORT}`, `localhost:${APP_PORT}`]);
const TILE_HOSTS = [
  "services.arcgisonline.com",
  "tile.openstreetmap.org",
  "s3.amazonaws.com",
];

const isProviderTileFetchError = (message) => (
  message === "TypeError: Failed to fetch" ||
  message.includes("AJAXError: Failed to fetch") &&
  TILE_HOSTS.some((host) => message.includes(host))
);

test.beforeEach(async ({ page }, testInfo) => {
  const errors = [];
  page.on("console", (message) => {
    const text = message.text();
    // MapLibre can omit the provider URL from this message. Same-origin fetch
    // failures are still captured with their URL by requestfailed below.
    if (message.type() === "error" && !isProviderTileFetchError(text)) errors.push(text);
    if (message.type() === "warning" && text.includes("Map cannot fit within canvas")) errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("requestfailed", (request) => {
    try {
      if (APP_HOSTS.has(new URL(request.url()).host)) {
        errors.push(`${request.failure()?.errorText || "Request failed"}: ${request.url()}`);
      }
    } catch {
      // A malformed third-party URL is not a local application failure.
    }
  });
  testInfo.errors = errors;
});

test.afterEach(async ({ page: _page }, testInfo) => {
  expect(testInfo.errors, "browser console and local requests should be clean").toEqual([]);
});

test("tour selection opens one MapLibre map", async ({ page }) => {
  await page.goto("./?view=tours");
  await expect(page).toHaveTitle("Albany Grave Finder");
  await expect(page.getByRole("heading", { name: "Search Tours" })).toBeVisible();

  await page.getByRole("button", { name: /Notables Tour 2020/ }).click();

  await expect(page).toHaveURL(/view=map.*tour=Notable/);
  await expect(page.getByRole("region", { name: "Albany Rural Cemetery map" })).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  const hillshade = page.getByLabel("Hillshade", { exact: true });
  await expect(hillshade).toBeChecked();
  await expect(page.getByRole("link", { name: "U.S. Geological Survey" })).toBeVisible();
  await hillshade.uncheck();
  await expect(page.getByRole("link", { name: "U.S. Geological Survey" })).toHaveCount(0);
  await hillshade.check();
  await expect(page.getByRole("link", { name: "U.S. Geological Survey" })).toBeVisible();
  await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]").getAttribute("data-visible-marker-count")))
    .toBe(38);
  await page.getByLabel("Sections", { exact: true }).check();
  await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();

  const placesPanel = page.getByRole("complementary", { name: "Notables Tour 2020" });
  await expect(placesPanel).toBeVisible();
  await expect(placesPanel.getByText("Tour places")).toBeVisible();
  await placesPanel.getByRole("button", { name: /James Hall/ }).click();
  await expect(page.getByRole("heading", { name: "James Hall" })).toBeVisible();
  await expect(page.getByText(/Notables Tour 2020 · Place \d+ of 38/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous place" })).toBeVisible();
  await expect(page.getByRole("button", { name: "All places" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next place" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Read biography/ }))
    .toHaveAttribute("href", "https://www.albany.edu/arce/Hall1.html");
  await expect.poll(() => new URL(page.url()).searchParams.get("record"))
    .toBe("tour:Notable:1:18:93");

  await page.reload();
  await expect(page.getByRole("heading", { name: "James Hall" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(placesPanel.getByRole("button", { name: /James Hall/ }))
    .toHaveAttribute("aria-current", "location");

  await page.setViewportSize({ width: 900, height: 700 });
  await placesPanel.getByRole("button", { name: /James Hall/ }).click();
  await expect(page.getByRole("heading", { name: "James Hall" })).toBeVisible();
  await expect(placesPanel).toBeHidden();
  await page.getByRole("button", { name: "All places" }).click();
  await expect(placesPanel).toBeVisible();

  await placesPanel.getByRole("button", { name: "All tours", exact: true }).click();
  await expect(page).toHaveURL(/view=tours/);
  await expect.poll(() => new URL(page.url()).searchParams.get("tour")).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get("record")).toBeNull();
  await expect(page.getByRole("button", { name: "Continue tour: Notables Tour 2020 from James Hall" }))
    .toBeVisible();
});

test("map context and appearance survive destination changes and reload", async ({ page }) => {
  await page.goto("./?view=tours");
  await page.getByRole("button", { name: /Notables Tour 2020/ }).click();
  await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]").getAttribute("data-visible-marker-count")))
    .toBe(38);

  await page.getByLabel("Hillshade", { exact: true }).uncheck();
  await page.getByLabel("Sections", { exact: true }).check();
  await page.getByRole("button", { name: "Search Tours", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("tour")).toBe("Notable");

  await page.getByRole("button", { name: "Cemetery Map", exact: true }).click();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.getByLabel("Hillshade", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();

  await page.reload();
  await expect(page.getByLabel("Hillshade", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();
  await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]").getAttribute("data-visible-marker-count")))
    .toBe(38);
});

test("burial search opens the selected grave on the map", async ({ page }) => {
  await page.goto("./?view=burials");
  await page.getByLabel("Name").fill("Thomas LaMont");

  const result = page.getByRole("button", { name: /Thomas E LaMont/ }).first();
  await expect(result).toBeVisible({ timeout: 30_000 });
  await result.click();

  await expect(page).toHaveURL(/view=map.*record=1/);
  await expect(page.getByRole("heading", { name: "Thomas E LaMont" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unpin" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(page.getByRole("heading", { name: "Thomas E LaMont" })).toHaveCount(0);
  await expect(page).toHaveURL(/record=1/);
});

test("section deep links browse the requested cemetery section", async ({ page }) => {
  await page.goto("./?view=burials&section=18");

  await expect(page.getByLabel("Section number")).toHaveValue("18");
  await expect(page.locator(".result-count")).toContainText("records");
  await expect(page.locator(".record-row").first()).toBeVisible({ timeout: 30_000 });
});

test("selected sections highlight the map and keep the useful burial list one action away", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?view=map&section=18");

  const appearance = page.getByLabel("Map appearance");
  const section = page.getByRole("group", { name: "Section 18" });
  await expect(section).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("map");
  const appearanceBox = await appearance.boundingBox();
  expect(appearanceBox.height).toBeLessThanOrEqual(56);

  await expect(section.getByText("Gold = grouped graves", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-visible-marker-count]")).toHaveAttribute("data-visible-marker-count", "0");

  await section.getByRole("button", { name: "View burials" }).click();
  await expect(page).toHaveURL(/view=burials.*section=18/);
  await page.goBack();
  await expect(page).toHaveURL(/view=map.*section=18/);
  const restoredSection = page.getByRole("group", { name: "Section 18" });
  await expect(restoredSection.getByRole("button", { name: "View burials" })).toBeVisible();
  await expect(page.locator("[data-visible-marker-count]")).toHaveAttribute("data-visible-marker-count", "0");
});

test("map attribution stays clear of mobile tour and detail overlays", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?view=map&tour=Notable");

  const attribution = page.locator(".maplibregl-ctrl-attrib");
  const controls = page.locator(".maplibregl-ctrl-top-right");
  const placesPanel = page.getByRole("complementary", { name: "Notables Tour 2020" });
  await expect(attribution).toBeVisible();
  await expect(placesPanel).toBeVisible();

  const attributionBox = await attribution.boundingBox();
  const controlsBox = await controls.boundingBox();
  const placesBox = await placesPanel.boundingBox();
  expect(attributionBox.y + attributionBox.height).toBeLessThanOrEqual(placesBox.y);
  expect(attributionBox.x + attributionBox.width).toBeLessThanOrEqual(controlsBox.x);

  await placesPanel.getByRole("button", { name: /James Hall/ }).click();
  const recordCard = page.getByRole("article", { name: "James Hall" });
  await expect(recordCard).toBeVisible();
  const detailAttributionBox = await attribution.boundingBox();
  const recordBox = await recordCard.boundingBox();
  expect(detailAttributionBox.y + detailAttributionBox.height).toBeLessThanOrEqual(recordBox.y);
  expect(detailAttributionBox.x + detailAttributionBox.width).toBeLessThanOrEqual(controlsBox.x);
});

test("short iPhone landscape keeps the mobile destination bar", async ({ page }) => {
  await page.setViewportSize({ width: 750, height: 342 });
  await page.goto("./?view=tours");

  await expect(page.locator(".app-navigation__brand")).toBeHidden();
  await expect(page.locator(".app-navigation__website")).toBeHidden();
  await expect(page.getByRole("button", { name: "Cemetery Map", exact: true })).toBeInViewport();

  await page.goto("./?view=map&tour=Notable");
  const placesPanel = page.getByRole("complementary", { name: "Notables Tour 2020" });
  const mapControls = page.locator(".maplibregl-ctrl-top-right");
  await expect(placesPanel).toBeVisible();
  const placesBox = await placesPanel.boundingBox();
  const controlsBox = await mapControls.boundingBox();
  expect(placesBox.x + placesBox.width).toBeLessThan(controlsBox.x);

  await placesPanel.getByRole("button", { name: /James Hall/ }).click();
  const recordCard = page.getByRole("article", { name: "James Hall" });
  await expect(recordCard).toBeVisible();
  const recordBox = await recordCard.boundingBox();
  expect(recordBox.x + recordBox.width).toBeLessThan(controlsBox.x);
});

test("narrow WebViews keep appearance and map controls separate", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./?view=map");

  const appearanceBox = await page.getByLabel("Map appearance").boundingBox();
  const controlsBox = await page.locator(".maplibregl-ctrl-top-right").boundingBox();
  expect(appearanceBox.x + appearanceBox.width).toBeLessThanOrEqual(320);
  expect(controlsBox.y).toBeGreaterThanOrEqual(appearanceBox.y + appearanceBox.height);
});

test("narrow tour panels keep the return to tours action reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./?view=map&tour=Notable");

  const placesPanel = page.getByRole("complementary", { name: "Notables Tour 2020" });
  const allTours = placesPanel.getByRole("button", { name: "All tours", exact: true });
  await expect(placesPanel).toBeVisible();
  await expect(allTours).toBeVisible();
  const actionBox = await allTours.boundingBox();
  expect(actionBox.x).toBeGreaterThanOrEqual(0);
  expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(320);

  await allTours.click();
  await expect(page).toHaveURL(/view=tours/);
});

test("mobile keeps the three primary destinations visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?view=tours");

  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation.getByRole("button", { name: "Search Tours" })).toBeInViewport();
  await expect(navigation.getByRole("button", { name: "Cemetery Map" })).toBeInViewport();
  await expect(navigation.getByRole("button", { name: "Burial Locator" })).toBeInViewport();
});

test("FABFG embedded routes do not duplicate native navigation", async ({ page }) => {
  for (const [view, heading] of [
    ["tours", "Search Tours"],
    ["map", "Cemetery Map"],
    ["burials", "Burial Locator"],
  ]) {
    await page.goto(`./?view=${view}&embed=fabfg`);
    await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
    if (view === "map") {
      await expect(page.getByRole("region", { name: "Albany Rural Cemetery map" })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  }
});
