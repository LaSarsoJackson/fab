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

  const stopPanel = page.getByRole("complementary", { name: "Notables Tour 2020" });
  await expect(stopPanel).toBeVisible();
  await stopPanel.getByRole("button", { name: /James Hall/ }).click();
  await expect(page.getByRole("heading", { name: "James Hall" })).toBeVisible();
  await expect(page.getByText(/Notables Tour 2020 · Stop \d+ of 38/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous stop" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next stop" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Read biography/ }))
    .toHaveAttribute("href", "https://www.albany.edu/arce/Hall1.html");
  await expect.poll(() => new URL(page.url()).searchParams.get("record"))
    .toBe("tour:Notable:1:18:93");

  await page.reload();
  await expect(page.getByRole("heading", { name: "James Hall" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(stopPanel.getByRole("button", { name: /James Hall/ }))
    .toHaveAttribute("aria-current", "location");
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

test("selected sections stay on the map until browsing is requested", async ({ page }) => {
  await page.goto("./?view=map&section=18");

  const browse = page.getByRole("button", { name: "View Section 18 burials" });
  await expect(browse).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("map");

  await browse.click();
  await expect(page).toHaveURL(/view=burials.*section=18/);
  await page.goBack();
  await expect(page).toHaveURL(/view=map.*section=18/);
  await expect(page.getByRole("button", { name: "View Section 18 burials" })).toBeVisible();
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
