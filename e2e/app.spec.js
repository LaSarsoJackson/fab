import { expect, test } from "@playwright/test";

const APP_PORT = process.env.PLAYWRIGHT_APP_PORT || "4173";
const APP_HOSTS = new Set([`127.0.0.1:${APP_PORT}`, `localhost:${APP_PORT}`]);
const TILE_HOSTS = ["tile.openstreetmap.org", "services.arcgisonline.com"];

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
  await expect(page.getByLabel("Map appearance")).toContainText("Hillshade");
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

  await page.getByRole("button", { name: "Search Tours", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue tour: Notables Tour 2020 from James Hall" }))
    .toBeVisible();
});

test("map context and appearance survive destination changes and reload", async ({ page }) => {
  await page.goto("./?view=tours");
  await page.getByRole("button", { name: /Notables Tour 2020/ }).click();
  await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]").getAttribute("data-visible-marker-count")))
    .toBe(38);

  await page.getByRole("button", { name: "Imagery", exact: true }).click();
  await page.getByLabel("Hillshade", { exact: true }).uncheck();
  await page.getByLabel("Sections", { exact: true }).check();
  await page.getByRole("button", { name: "Search Tours", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("tour")).toBe("Notable");

  await page.getByRole("button", { name: "Cemetery Map", exact: true }).click();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Imagery", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Hillshade", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Sections", { exact: true })).toBeChecked();

  await page.reload();
  await expect(page.getByRole("button", { name: "Imagery", exact: true })).toHaveAttribute("aria-pressed", "true");
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

test("selected sections map every burial and keep the list one action away", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?view=map&section=18");

  const appearance = page.getByLabel("Map appearance");
  const section = page.getByRole("group", { name: "Section 18" });
  await expect(section).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("map");
  const appearanceBox = await appearance.boundingBox();
  expect(appearanceBox.height).toBeLessThanOrEqual(56);

  const burialCount = section.getByText(/burials$/);
  await expect(burialCount).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => Number((await burialCount.textContent()).replace(/\D/g, "")))
    .toBeGreaterThan(0);
  await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]").getAttribute("data-visible-marker-count")))
    .toBeGreaterThan(0);

  await section.getByRole("button", { name: "List" }).click();
  await expect(page).toHaveURL(/view=burials.*section=18/);
  await page.goBack();
  await expect(page).toHaveURL(/view=map.*section=18/);
  const restoredSection = page.getByRole("group", { name: "Section 18" });
  await expect(restoredSection.getByText(/burials$/)).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]").getAttribute("data-visible-marker-count")))
    .toBeGreaterThan(0);
});

test("clicking a burial cluster reveals its children without clearing the section", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./?view=map&section=18");

  const section = page.getByRole("group", { name: "Section 18" });
  const burialCount = section.getByText(/burials$/);
  const visibleCount = page.locator("[data-visible-marker-count]");
  await expect.poll(async () => Number((await burialCount.textContent()).replace(/\D/g, "")))
    .toBeGreaterThan(0);
  await expect.poll(async () => Number(
    await visibleCount.getAttribute("data-visible-marker-count")
  )).toBeGreaterThan(0);
  const initialVisibleCount = Number(await visibleCount.getAttribute("data-visible-marker-count"));
  await page.waitForTimeout(800);

  const mapCanvas = page.locator(".maplibregl-canvas");
  // This fixed viewport places a dense Section 18 cluster at this canvas point.
  // The count change below proves the click expanded it instead of hitting bare map.
  await mapCanvas.click({ position: { x: 620, y: 186 } });

  await expect.poll(() => new URL(page.url()).searchParams.get("section")).toBe("18");
  await expect.poll(async () => Number((await burialCount.textContent()).replace(/\D/g, "")))
    .toBeGreaterThan(0);
  await expect.poll(async () => Number(await visibleCount.getAttribute("data-visible-marker-count")))
    .not.toBe(initialVisibleCount);
  await expect.poll(async () => Number(await visibleCount.getAttribute("data-visible-marker-count")))
    .toBeGreaterThan(0);
});

test("selecting a grave preserves a closer map zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./?view=map&section=18");

  const visibleCount = page.locator("[data-visible-marker-count]");
  await expect.poll(async () => Number(await visibleCount.getAttribute("data-visible-marker-count")))
    .toBeGreaterThan(0);
  await page.waitForTimeout(800);
  const mapCanvas = page.locator(".maplibregl-canvas");
  await mapCanvas.click({ position: { x: 620, y: 186 } });
  await expect.poll(async () => Number(await visibleCount.getAttribute("data-visible-marker-count")))
    .toBeGreaterThan(100);

  await mapCanvas.click({ position: { x: 565, y: 293 } });
  await expect(page.getByRole("article")).toBeVisible();
  const firstRecord = new URL(page.url()).searchParams.get("record");

  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  await zoomIn.click();
  await page.waitForTimeout(400);
  await zoomIn.click();
  await expect(zoomIn).toBeDisabled();

  await mapCanvas.click({ position: { x: 734, y: 204 } });
  await expect.poll(() => new URL(page.url()).searchParams.get("record"))
    .not.toBe(firstRecord);
  await expect(zoomIn).toBeDisabled();
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
