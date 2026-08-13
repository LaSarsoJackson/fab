/**
 * Browser smoke tests for the shipped Tours, Map, and Search destinations.
 * These watch local asset failures and uncaught browser errors because many
 * map regressions surface as loading failures before a clear DOM assertion.
 */
const { test, expect } = require("@playwright/test");

const TEST_APP_PORT = process.env.PLAYWRIGHT_APP_PORT || "4173";
const TEST_IMAGE_PORT = process.env.PLAYWRIGHT_IMAGE_PORT || "8173";
const APP_HOSTS = new Set([
  `127.0.0.1:${TEST_APP_PORT}`,
  `localhost:${TEST_APP_PORT}`,
  `127.0.0.1:${TEST_IMAGE_PORT}`,
  `localhost:${TEST_IMAGE_PORT}`,
]);

const isIgnorableConsoleError = (text = "") => /^Failed to load resource:/i.test(text);

test.beforeEach(async ({ page }, testInfo) => {
  const consoleErrors = [];
  const pageErrors = [];
  const localRequestFailures = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !isIgnorableConsoleError(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("requestfailed", (request) => {
    let hostname = "";
    try {
      hostname = new URL(request.url()).host;
    } catch (error) {
      hostname = "";
    }
    if (APP_HOSTS.has(hostname)) {
      localRequestFailures.push(`${request.failure()?.errorText || "Request failed"}: ${request.url()}`);
    }
  });

  testInfo._consoleErrors = consoleErrors;
  testInfo._pageErrors = pageErrors;
  testInfo._localRequestFailures = localRequestFailures;
});

test.afterEach(async ({ page }, testInfo) => {
  void page;
  const diagnostics = [
    ["console-errors.txt", testInfo._consoleErrors || []],
    ["page-errors.txt", testInfo._pageErrors || []],
    ["local-request-failures.txt", testInfo._localRequestFailures || []],
  ];

  for (const [name, messages] of diagnostics) {
    if (messages.length > 0) {
      await testInfo.attach(name, {
        body: messages.join("\n\n"),
        contentType: "text/plain",
      });
    }
    expect(messages, `${name} should be empty.`).toEqual([]);
  }
});

async function openTours(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose a tour" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
}

async function openSearch(page) {
  await openTours(page);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\?view=burials$/);
  const input = page.getByRole("textbox", { name: "Search burials" });
  await expect(input).toBeVisible();
  return input;
}

async function searchForLamont(page) {
  const input = await openSearch(page);
  await input.fill("lamont");
  const result = page.locator(".left-sidebar__result-card").filter({ hasText: "Thomas E LaMont" }).first();
  await expect(result).toBeVisible({ timeout: 60_000 });
  return result;
}

test.describe("simplified navigation", () => {
  test("Tours is the default and launch does not mount the map or a drawer", async ({ page }) => {
    await openTours(page);

    await expect(page.getByRole("button", { name: "Tours", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".fab-tour-catalog__row")).not.toHaveCount(0);
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
    await expect(page.locator("[data-rsbs-root], [data-rsbs-overlay]")).toHaveCount(0);
  });

  test("a tour opens directly on the Map destination", async ({ page }) => {
    await openTours(page);
    await page.getByRole("button", { name: /Notables Tour 2020/ }).click();

    await expect(page.getByRole("button", { name: "Map", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".leaflet-container")).toBeVisible();
    const firstTourMarker = page.locator(".leaflet-marker-icon.tour-marker").first();
    await expect(firstTourMarker).toBeVisible({ timeout: 60_000 });
    await expect(firstTourMarker).toHaveAttribute("aria-label", /Notables Tour 2020/);
    await expect(page.locator(".tour-context-overlay")).toContainText("Notables Tour 2020");
    const markerBounds = await firstTourMarker.boundingBox();
    expect(markerBounds.width).toBeGreaterThanOrEqual(44);
    expect(markerBounds.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("[data-rsbs-root], [data-rsbs-overlay]")).toHaveCount(0);
  });

  test("Search starts clean and keeps its query across a Map visit", async ({ page }) => {
    const input = await openSearch(page);
    await expect(page.getByText("Keep typing.")).toHaveCount(0);
    await input.fill("lamont");

    const result = page.locator(".left-sidebar__result-card").filter({ hasText: "Thomas E LaMont" }).first();
    await expect(result).toBeVisible({ timeout: 60_000 });
    await result.click();
    await expect(page.locator(".leaflet-popup .popup-card")).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Search burials" })).toHaveValue("lamont");
    await expect(result).toBeVisible();
    await expect(page.locator(".tour-marker, .tour-context-overlay")).toHaveCount(0);
  });

  test("searching for a burial opens its map popup", async ({ page }) => {
    const result = await searchForLamont(page);
    await result.click();

    await expect(page.getByRole("button", { name: "Map", exact: true })).toHaveAttribute("aria-current", "page");
    const popup = page.locator(".leaflet-popup .popup-card");
    await expect(popup).toBeVisible({ timeout: 60_000 });
    await expect(popup).toContainText("Thomas E LaMont");
    await page.evaluate(() => {
      Object.defineProperty(Navigator.prototype, "userAgent", {
        configurable: true,
        get: () => "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36",
      });
      window.__fabExternalMapsOpenCalls = [];
      window.open = (...args) => {
        window.__fabExternalMapsOpenCalls.push(args);
        return { opener: null };
      };
    });
    await popup.getByRole("button", { name: "Navigate" }).click();
    await expect.poll(() => page.evaluate(() => (
      window.__fabExternalMapsOpenCalls?.[0]?.[0]
        || ""
    ))).toMatch(/maps\.apple\.com|google\.com\/maps\/dir/i);
  });

  test("section browsing remains available from Search", async ({ page }) => {
    await openSearch(page);
    await page.getByRole("button", { name: "Browse by section" }).click();

    const sectionInput = page.getByRole("combobox", { name: "Section" });
    await sectionInput.fill("215");
    await page.getByRole("option", { name: "Section 215" }).click();
    await expect(sectionInput).toHaveValue("Section 215");
    await expect(page.locator(".left-sidebar__result-card").first()).toBeVisible({ timeout: 60_000 });
  });

  test("a burial deep link restores the Map destination and popup", async ({ page }) => {
    await page.goto("/?view=burials&q=lamont");

    await expect(page.getByRole("button", { name: "Map", exact: true })).toHaveAttribute("aria-current", "page");
    const popup = page.locator(".leaflet-popup .popup-card");
    await expect(popup).toBeVisible({ timeout: 60_000 });
    await expect(popup).toContainText("Thomas E LaMont");
  });

  test("repeated destination changes leave one stable map and no sheet", async ({ page }) => {
    await openTours(page);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.getByRole("button", { name: "Map", exact: true }).click();
      await expect(page.locator(".leaflet-container")).toHaveCount(1);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Find a grave" })).toBeVisible();
      await expect(page.locator(".map-stage--hidden .leaflet-container")).toHaveCount(1);
      await page.getByRole("button", { name: "Tours", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Choose a tour" })).toBeVisible();
    }

    await expect(page.locator("[data-rsbs-root], [data-rsbs-overlay]")).toHaveCount(0);
  });
});

test.describe("mobile shell", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("the three primary destinations stay fixed and usable without a drawer", async ({ page }) => {
    await openTours(page);
    const navigation = page.getByRole("navigation", { name: "Primary" });

    await expect(navigation.getByRole("button")).toHaveCount(3);
    await expect(navigation.getByRole("button", { name: "Tours", exact: true })).toBeInViewport();
    await expect(navigation.getByRole("button", { name: "Map", exact: true })).toBeInViewport();
    await expect(navigation.getByRole("button", { name: "Search", exact: true })).toBeInViewport();
    await expect(page.locator("[data-rsbs-root], [data-rsbs-overlay]")).toHaveCount(0);

    const bounds = await navigation.boundingBox();
    expect(bounds.y + bounds.height).toBeGreaterThan(800);
  });

  test("mobile Search opens a usable anchored popup on the Map", async ({ page }) => {
    const result = await searchForLamont(page);
    await result.click();

    const popup = page.locator(".leaflet-popup .popup-card");
    await expect(popup).toBeVisible({ timeout: 60_000 });
    await expect(popup).toBeInViewport();
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(popup).toBeInViewport();
    await expect(page.locator("[data-rsbs-root], [data-rsbs-overlay]")).toHaveCount(0);
  });
});
