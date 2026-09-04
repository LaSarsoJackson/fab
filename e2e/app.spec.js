import { expect, test } from "@playwright/test";

const APP_PORT = process.env.PLAYWRIGHT_APP_PORT || "4173";
const APP_HOSTS = new Set([`127.0.0.1:${APP_PORT}`, `localhost:${APP_PORT}`]);
const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "s3.amazonaws.com",
];

const isProviderTileFetchError = (message) => (
  message === "TypeError: Failed to fetch" ||
  message.includes("AJAXError: Failed to fetch") &&
  TILE_HOSTS.some((host) => message.includes(host))
);

const expectNoOverlap = async (first, second) => {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(
    a.x + a.width <= b.x || b.x + b.width <= a.x ||
    a.y + a.height <= b.y || b.y + b.height <= a.y,
  ).toBe(true);
};

const openAttribution = async (page) => {
  const attribution = page.locator(".maplibregl-ctrl-attrib");
  await expect(attribution).toHaveClass(/maplibregl-compact$/);
  await page.getByLabel("Map credits").click();
  const attributionBox = await attribution.boundingBox();
  const mapBox = await page.locator(".maplibregl-map").boundingBox();
  expect(attributionBox.y + attributionBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height);
  return attribution;
};

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
  const terrain = page.getByLabel("Terrain", { exact: true });
  await expect(terrain).toBeChecked();
  await openAttribution(page);
  await expect(page.getByRole("link", { name: "U.S. Geological Survey" })).toBeVisible();
  await terrain.uncheck();
  await expect(page.getByRole("link", { name: "U.S. Geological Survey" })).toHaveCount(0);
  await terrain.check();
  await expect(page.getByRole("link", { name: "U.S. Geological Survey" })).toBeVisible();
  await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]").getAttribute("data-visible-marker-count")))
    .toBe(38);
  await page.getByLabel("Sections", { exact: true }).check();
  await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();

  const placesPanel = page.getByRole("complementary", { name: "Notables Tour 2020" });
  await expect(placesPanel).toBeVisible();
  await expect(placesPanel.getByText("38 stops")).toBeVisible();
  await placesPanel.getByRole("button", { name: /James Hall/ }).click();
  await expect(page.getByRole("heading", { name: "James Hall" })).toBeVisible();
  await expect(page.getByText(/Notables Tour 2020 · \d+ of 38/)).toBeVisible();
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

  await page.setViewportSize({ width: 720, height: 500 });
  await placesPanel.getByRole("button", { name: /James Hall/ }).click();
  const recordCard = page.getByRole("article", { name: "James Hall" });
  const mapControls = page.locator(".maplibregl-ctrl-top-right");
  const attribution = page.locator(".maplibregl-ctrl-attrib");
  await expect(recordCard).toBeVisible();
  await expect(placesPanel).toBeHidden();
  await expectNoOverlap(recordCard, mapControls);
  await expectNoOverlap(recordCard, attribution);
  await page.getByRole("button", { name: "All places" }).click();
  await expect(placesPanel).toBeVisible();
  await expectNoOverlap(placesPanel, mapControls);
  await expectNoOverlap(placesPanel, attribution);

  await placesPanel.getByRole("button", { name: "Back to Search Tours" }).click();
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

  await page.getByLabel("Terrain", { exact: true }).uncheck();
  await page.getByLabel("Sections", { exact: true }).check();
  await page.getByRole("button", { name: "Search Tours", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("tour")).toBe("Notable");

  await page.getByRole("button", { name: "Cemetery Map", exact: true }).click();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.getByLabel("Terrain", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();

  await page.reload();
  await expect(page.getByLabel("Terrain", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();
  await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]").getAttribute("data-visible-marker-count")))
    .toBe(38);
});

test("collections stay list-first and pin only the chosen grave", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?view=tours");
  await page.getByRole("button", { name: /Section 49.*Browse graves/ }).click();

  const panel = page.getByRole("complementary", { name: "Section 49" });
  await expect(panel.getByText("1,060 graves")).toBeVisible();
  await expect(panel.locator(".tour-stop__number")).toHaveCount(0);
  await expect(page.locator("[data-visible-marker-count]")).toHaveAttribute("data-visible-marker-count", "0");

  const firstGrave = panel.locator(".tour-stop").first();
  const graveName = await firstGrave.locator("strong").innerText();
  await firstGrave.click();
  await expect(page.getByRole("heading", { name: graveName })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unpin" })).toBeVisible();
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

  await expect(page.getByLabel("Section")).toHaveValue("18");
  await expect(page.locator(".result-count")).toContainText("matches");
  await expect(page.locator(".record-row").first()).toBeVisible({ timeout: 30_000 });
});

// Interior points in Section 18 at the map's initial camera for each viewport.
for (const { viewport, sectionPoint } of [
  { viewport: { width: 1440, height: 960 }, sectionPoint: { x: 697, y: 244 } },
  { viewport: { width: 390, height: 844 }, sectionPoint: { x: 171, y: 238 } },
]) {
  test(`section taps work with section shading off at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("./?view=map");
    await expect(page.getByLabel("Sections", { exact: true })).not.toBeChecked();
    await expect(page.locator("[data-visible-marker-count]")).toHaveAttribute("data-visible-marker-count", "0");

    const canvas = page.locator(".maplibregl-canvas");
    await expect.poll(async () => {
      await canvas.hover({ position: sectionPoint });
      return canvas.evaluate((element) => element.style.cursor);
    }).toBe("pointer");
    await canvas.click({ position: sectionPoint });

    const sectionContext = page.getByRole("group", { name: "Section 18" });
    await expect(sectionContext).toBeVisible();
    await expect(page).toHaveURL(/view=map.*section=18/);
    await sectionContext.getByRole("button", { name: "View burials" }).click();
    await expect(page.getByLabel("Section", { exact: true })).toHaveValue("18");
    await expect(page.locator(".record-row").first()).toBeVisible();
  });
}

test("selected sections highlight the map and keep the useful burial list one action away", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?view=map&section=18");

  const appearance = page.getByLabel("Map options");
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

test("short iPhone landscape keeps the mobile destination bar", async ({ page }) => {
  await page.setViewportSize({ width: 750, height: 342 });
  await page.goto("./?view=tours");

  await expect(page.locator(".app-navigation__brand")).toBeHidden();
  await expect(page.locator(".app-navigation__website")).toBeHidden();
  await expect(page.getByRole("button", { name: "Cemetery Map", exact: true })).toBeInViewport();

  await page.goto("./?view=map&tour=Notable");
  const placesPanel = page.getByRole("complementary", { name: "Notables Tour 2020" });
  const mapControls = page.locator(".maplibregl-ctrl-top-right");
  const attribution = await openAttribution(page);
  await expect(placesPanel).toBeVisible();
  await expectNoOverlap(placesPanel, mapControls);
  await expectNoOverlap(placesPanel, attribution);
  await expectNoOverlap(mapControls, attribution);

  await placesPanel.getByRole("button", { name: /James Hall/ }).click();
  const recordCard = page.getByRole("article", { name: "James Hall" });
  await expect(recordCard).toBeVisible();
  await expectNoOverlap(recordCard, mapControls);
  await expectNoOverlap(recordCard, attribution);
});

test("narrow WebViews keep appearance and map controls separate", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./?view=map&tour=Notable");

  const appearance = page.getByLabel("Map options");
  const controls = page.locator(".maplibregl-ctrl-top-right");
  const attribution = await openAttribution(page);
  const placesPanel = page.getByRole("complementary", { name: "Notables Tour 2020" });
  const allTours = placesPanel.getByRole("button", { name: "Back to Search Tours" });
  await expectNoOverlap(appearance, controls);
  await expect(allTours).toBeInViewport();

  await placesPanel.getByRole("button", { name: /James Hall/ }).click();
  const recordCard = page.getByRole("article", { name: "James Hall" });
  await expectNoOverlap(controls, recordCard);
  await expectNoOverlap(attribution, recordCard);

  await page.getByRole("button", { name: "All places" }).click();
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

test("FABFG receives the complete Map route when a hosted tour is selected", async ({ page }) => {
  await page.addInitScript(() => {
    window.__fabfgMessages = [];
    window.ReactNativeWebView = {
      postMessage(message) {
        window.__fabfgMessages.push(JSON.parse(message));
      },
    };
  });
  await page.goto("./?view=tours&embed=fabfg&campaign=summer");

  await page.getByRole("button", { name: /Notables Tour 2020/ }).click();
  await expect(page).toHaveURL(/view=tours/);
  await expect(page.getByRole("heading", { name: "Search Tours" })).toBeVisible();

  const message = await page.evaluate(() => window.__fabfgMessages.at(-1));
  expect(message.type).toBe("fab.route-change.v1");
  expect(message.view).toBe("map");
  const url = new URL(message.url);
  expect(url.searchParams.get("view")).toBe("map");
  expect(url.searchParams.get("tour")).toBe("Notable");
  expect(url.searchParams.get("embed")).toBe("fabfg");
  expect(url.searchParams.get("campaign")).toBe("summer");
});

test("FABFG receives the complete Burials route when browsing a map section", async ({ page }) => {
  await page.addInitScript(() => {
    window.__fabfgMessages = [];
    window.ReactNativeWebView = {
      postMessage(message) {
        window.__fabfgMessages.push(JSON.parse(message));
      },
    };
  });
  await page.goto("./?view=map&section=18&embed=fabfg");

  await page.getByRole("button", { name: "View burials" }).click();
  await expect(page).toHaveURL(/view=map/);
  await expect(page.getByRole("region", { name: "Albany Rural Cemetery map" })).toBeVisible();

  const message = await page.evaluate(() => window.__fabfgMessages.at(-1));
  expect(message.type).toBe("fab.route-change.v1");
  expect(message.view).toBe("burials");
  const url = new URL(message.url);
  expect(url.searchParams.get("view")).toBe("burials");
  expect(url.searchParams.get("section")).toBe("18");
  expect(url.searchParams.get("embed")).toBe("fabfg");
});
