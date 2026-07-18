/**
 * Browser smoke tests for the shipped map/search flow. These tests watch local
 * asset failures and uncaught browser errors because many regressions surface
 * as broken map data loads before they produce a clear DOM assertion failure.
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

const TEST_APP_PATH = "/";
const isIgnorableConsoleError = (text = "") => /^Failed to load resource:/i.test(text);
const buildAppPath = (searchParams = "") => {
  if (!searchParams) {
    return TEST_APP_PATH;
  }

  const separator = TEST_APP_PATH.includes("?") ? "&" : "?";
  return `${TEST_APP_PATH}${separator}${searchParams}`;
};
const encodeSharePacketPayload = (packet) => (
  Buffer.from(JSON.stringify(packet), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
);

test.beforeEach(async ({ page }, testInfo) => {
  const consoleErrors = [];
  const pageErrors = [];
  const localRequestFailures = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !isIgnorableConsoleError(message.text())) {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message);
  });

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

  const consoleErrors = testInfo._consoleErrors || [];
  const pageErrors = testInfo._pageErrors || [];
  const localRequestFailures = testInfo._localRequestFailures || [];

  if (consoleErrors.length > 0) {
    await testInfo.attach("console-errors.txt", {
      body: consoleErrors.join("\n\n"),
      contentType: "text/plain",
    });
  }

  if (pageErrors.length > 0) {
    await testInfo.attach("page-errors.txt", {
      body: pageErrors.join("\n\n"),
      contentType: "text/plain",
    });
  }

  if (localRequestFailures.length > 0) {
    await testInfo.attach("local-request-failures.txt", {
      body: localRequestFailures.join("\n\n"),
      contentType: "text/plain",
    });
  }

  expect(pageErrors, "The page threw an uncaught runtime exception.").toEqual([]);
  expect(consoleErrors, "The app logged a browser console error.").toEqual([]);
  expect(localRequestFailures, "The app had a failed local request.").toEqual([]);
});

async function getVisibleSearchInput(page, { requireEditable = true } = {}) {
  const browseSearchInput = page.locator('input[name="browse_query"]').first();
  await expect(browseSearchInput).toBeVisible();

  if (requireEditable) {
    await expect(browseSearchInput).toBeEditable({ timeout: 45_000 });
  }

  return browseSearchInput;
}

async function waitForAppReady(page, path = TEST_APP_PATH) {
  await page.goto(path);

  const searchInput = await getVisibleSearchInput(page, { requireEditable: false });
  await expect(searchInput).toBeVisible();
  await expect(page.getByText("Loading tour stops…")).toHaveCount(0);

  return searchInput;
}

async function ensureBurialDataLoaded(page) {
  const searchInput = await getVisibleSearchInput(page, { requireEditable: false });
  const burialDataError = page.getByText("Burial records failed to load. Refresh and try again.");

  if (await searchInput.isEditable()) {
    await expect(searchInput).toBeEditable({ timeout: 45_000 });
    return;
  }

  await searchInput.click();
  await expect(burialDataError).toHaveCount(0, { timeout: 60_000 });
  await expect(searchInput).toBeEditable({ timeout: 60_000 });
  await expect(page.getByText("Loading burials…")).toHaveCount(0, { timeout: 60_000 });
}

async function searchForLamont(page) {
  const searchInput = await getVisibleSearchInput(page);
  await searchInput.fill("lamont");
  await expect(searchInput).toHaveValue("lamont");

  const browseResults = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card");
  await expect(browseResults.first()).toContainText("Thomas E LaMont");
  await expect(page.getByText("Preparing search…")).toHaveCount(0);

  return browseResults;
}

async function expectExternalMapsNavigation(page, triggerNavigation) {
  const externalMapsPattern = /maps\.apple\.com|google\.com\/maps\/dir/i;
  const usesPopupTarget = await page.evaluate(() => !(
    /iphone|ipad|ipod|macintosh|mac os x|android/i.test(navigator.userAgent)
  ));
  if (usesPopupTarget) {
    await page.evaluate(() => {
      const nativeOpen = window.open.bind(window);
      window.__fabExternalMapsOpenCalls = [];
      window.open = (...args) => {
        window.__fabExternalMapsOpenCalls.push(args);
        return nativeOpen(...args);
      };
    });
  }
  const popupPromise = page
    .waitForEvent("popup", { timeout: 20_000 })
    .then((popup) => ({ type: "popup", popup }));
  const sameTabNavigationPromise = page
    .waitForURL(externalMapsPattern, { timeout: 20_000 })
    .then(() => ({ type: "same-tab" }));

  await triggerNavigation();
  if (usesPopupTarget) {
    await expect.poll(() => page.evaluate(() => window.__fabExternalMapsOpenCalls?.length || 0), {
      message: "Expected desktop Maps to open synchronously from the Navigate click.",
      timeout: 500,
    }).toBe(1);
  }

  let navigationTarget = null;

  try {
    navigationTarget = await Promise.any([popupPromise, sameTabNavigationPromise]);
  } catch (error) {
    throw new Error("Expected Navigate to launch Apple Maps or Google Maps.");
  }

  if (navigationTarget.type === "popup") {
    await navigationTarget.popup.waitForLoadState("domcontentloaded");
    await expect(navigationTarget.popup).toHaveURL(externalMapsPattern, { timeout: 20_000 });
    await navigationTarget.popup.close();
    return;
  }

  await expect(page).toHaveURL(externalMapsPattern, { timeout: 20_000 });
}

async function expectHitTarget(locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeInViewport({ ratio: 1 });
  await expect.poll(() => locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const topElement = document.elementFromPoint(
      bounds.left + (bounds.width / 2),
      bounds.top + (bounds.height / 2)
    );
    return topElement === element || element.contains(topElement);
  })).toBe(true);
}

async function getSelectedMarkerCenter(page) {
  const marker = page.locator(".selected-location-marker-icon").first();
  await expect(marker).toBeVisible();

  const markerBox = await marker.boundingBox();
  if (!markerBox) {
    throw new Error("Expected selected marker to have a screen position.");
  }

  return {
    x: markerBox.x + (markerBox.width / 2),
    y: markerBox.y + (markerBox.height / 2),
  };
}

async function waitForStableSelectedMarkerCenter(page, tolerance = 1) {
  let previousCenter = null;
  let currentCenter = null;
  let stableSamples = 0;

  await expect.poll(async () => {
    currentCenter = await getSelectedMarkerCenter(page);
    const isStable = previousCenter
      && Math.abs(currentCenter.x - previousCenter.x) <= tolerance
      && Math.abs(currentCenter.y - previousCenter.y) <= tolerance;
    stableSamples = isStable ? stableSamples + 1 : 0;
    previousCenter = currentCenter;
    return stableSamples;
  }, {
    intervals: [100, 100, 100, 150, 250],
    timeout: 15_000,
  }).toBeGreaterThanOrEqual(3);

  return currentCenter;
}

async function primeOnSiteLocation(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Locate" }).click();
  await expect(page.getByText("Using your current location for directions.")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(page.locator(".left-sidebar--desktop")).toBeVisible();
}

async function dragMapBy(page, { deltaX, deltaY }) {
  const mapBox = await page.locator(".leaflet-container").boundingBox();
  if (!mapBox) {
    throw new Error("Expected map container to be visible for dragging.");
  }

  const startX = mapBox.x + (mapBox.width * 0.62);
  const startY = mapBox.y + (mapBox.height * 0.58);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

async function swipeElementUp(page, locator, { distance = 180, steps = 6 } = {}) {
  const bounds = await locator.boundingBox();
  if (!bounds) {
    throw new Error("Expected a visible element to swipe.");
  }

  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error("Expected a fixed viewport for touch emulation.");
  }

  const client = await page.context().newCDPSession(page);
  const x = bounds.x + (bounds.width / 2);
  const visibleTop = Math.max(0, bounds.y);
  const visibleBottom = Math.min(viewport.height, bounds.y + bounds.height);
  const startY = visibleBottom - 16;
  const endY = Math.max(visibleTop + 16, startY - distance);

  if (endY >= startY) {
    await client.detach();
    throw new Error("Expected enough visible picker height for an upward swipe.");
  }

  try {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: startY }],
    });

    for (let step = 1; step <= steps; step += 1) {
      const y = startY + ((endY - startY) * (step / steps));
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y }],
      });
      await page.waitForTimeout(16);
    }

    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await client.detach();
  }
}

async function waitForSettledSheetTop(locator, tolerance = 1) {
  let previousTop = null;
  let currentTop = null;
  let stableSamples = 0;

  await expect.poll(async () => {
    const measurement = await locator.evaluate((element) => ({
      sheetState: element.closest("[data-rsbs-root]")?.getAttribute("data-rsbs-state") || "",
      top: element.getBoundingClientRect().top,
    }));
    currentTop = measurement.top;
    const isStable = measurement.sheetState === "open"
      && previousTop !== null
      && Math.abs(currentTop - previousTop) <= tolerance;
    stableSamples = isStable ? stableSamples + 1 : 0;
    previousTop = measurement.sheetState === "open" ? currentTop : null;
    return stableSamples;
  }, {
    intervals: [100, 100, 100, 100, 100, 250],
    timeout: 15_000,
  }).toBeGreaterThanOrEqual(4);

  return currentTop;
}

test.describe("desktop", () => {
  test("searching for a burial keeps map actions in the selected summary", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);
    await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const popupCard = page.locator(".leaflet-popup .popup-card");
    const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
    await expect(popupCard).toBeVisible();
    await expect(popupCard).toHaveClass(/popup-card--compact/);
    await expect(popupCard.locator(".popup-card__title")).toHaveText("Thomas E LaMont");
    await expect(popupCard.locator(".popup-card__subtitle")).toContainText("Section 215, Lot 30, Tier 0, Grave 0");
    await expect(popupCard.getByRole("button", { name: "Navigate" })).toHaveCount(0);
    await expect(popupCard.getByRole("button", { name: "Close" })).toHaveCount(0);
    await expect(popupCard.getByRole("link", { name: "Details" })).toHaveCount(0);
    await expect(selectedPeoplePanel.getByRole("button", { name: "Navigate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
    await waitForStableSelectedMarkerCenter(page);

    await expectExternalMapsNavigation(page, () => (
      selectedPeoplePanel.getByRole("button", { name: "Navigate" }).click()
    ));
  });

  test("collapsing desktop search upgrades the open popup to full controls", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const popupCard = page.locator(".leaflet-popup .popup-card");
    await expect(popupCard).toBeVisible();
    await expect(popupCard).toHaveClass(/popup-card--compact/);

    await page.getByRole("button", { name: "Collapse" }).click();

    await expect(page.locator(".left-sidebar--desktop")).toHaveCount(0);
    await expect(popupCard).toBeVisible();
    await expect(popupCard).not.toHaveClass(/popup-card--compact/);
    await expect(popupCard.getByRole("button", { name: "Navigate" })).toBeVisible();
    await expect(popupCard.getByRole("button", { name: "Close" })).toBeVisible();

    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.locator(".left-sidebar--desktop")).toBeVisible();
    await expect(await getVisibleSearchInput(page, { requireEditable: false })).toBeVisible();
  });

  test("desktop search panel can be hidden and restored", async ({ page }) => {
    await waitForAppReady(page);

    await expect(page.locator(".left-sidebar--desktop")).toBeVisible();
    await page.getByRole("button", { name: "Collapse" }).click();

    await expect(page.locator(".left-sidebar--desktop")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();

    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator(".left-sidebar--desktop")).toBeVisible();
    await expect(await getVisibleSearchInput(page, { requireEditable: false })).toBeVisible();
  });

  test("section browsing shows section-scoped results and can be cleared", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("button", { name: "Sections", exact: true }).click();
    const sectionBrowseDetail = page.locator(".left-sidebar__browse-detail--section");
    const browseSearchInput = page.locator(".left-sidebar__browse-composer input").first();

    await expect(sectionBrowseDetail).toContainText("Choose a section to zoom in.");

    const sectionInput = page.getByRole("combobox", { name: "Section" });
    await sectionInput.click();
    await sectionInput.fill("215");
    await page.getByRole("option", { name: "Section 215" }).click();
    await expect(sectionInput).toHaveValue("Section 215");
    await expect(browseSearchInput).toHaveAttribute("placeholder", "Search this section");
    await expect(sectionBrowseDetail.getByRole("heading", { name: "Filter records" })).toBeVisible();
    await expect(page.locator(".left-sidebar__panel--browse")).toContainText("114 results");

    const browseResults = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card");
    await expect(browseResults).toHaveCount(114);
    await expect(page.locator(".left-sidebar__panel--browse")).not.toContainText(/Showing \d+ of \d+/);
    await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(0);
    await browseResults.first().click();

    await expect(page.locator(".popup-card")).toBeVisible();

    await sectionBrowseDetail.getByRole("button", { name: "Clear" }).click();
    await expect(sectionInput).toHaveValue("");
    await expect(browseSearchInput).toHaveAttribute("placeholder", "Select a section to browse");
    await expect(sectionBrowseDetail.getByRole("heading", { name: "Filter records" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /grave markers in this section/i })).toHaveCount(0);
  });

  test("tour browsing loads stops and lets a user inspect a tour stop popup", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("button", { name: "Tours", exact: true }).click();

    const tourInput = page.getByRole("combobox", { name: "Tour" });
    await tourInput.click();
    await page.getByRole("option", { name: "Notables Tour 2020" }).click();

    await expect(page.getByText("Loading Notables Tour 2020…")).toHaveCount(0, { timeout: 45_000 });

    const browseResults = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card");
    await expect(browseResults.first()).toBeVisible({ timeout: 45_000 });

    const selectedHeading = (await browseResults.first().getByRole("heading").textContent()).trim();
    const tourMarker = page.locator(".leaflet-marker-icon.tour-marker").first();
    await expect(tourMarker).toBeVisible();
    await tourMarker.click();

    const popupCard = page.locator(".leaflet-popup .popup-card");
    await expect(popupCard).toBeVisible();
    await expect(page.locator(".leaflet-popup .popup-card-stack")).toHaveCount(0);
    await expect(popupCard).toHaveClass(/popup-card--compact/);
    await expect(popupCard.locator(".popup-card__eyebrow")).toHaveCount(0);
    await expect(popupCard.getByRole("button", { name: "Navigate" })).toHaveCount(0);
    await expect(popupCard.locator(".popup-card__title")).toHaveText(selectedHeading);
    await expect(page.locator(".left-sidebar__panel--selected-summary")).toContainText(selectedHeading);
    await popupCard.evaluate((element) => {
      element.setAttribute("data-e2e-popup-instance", "tour-popup-before-collapse");
    });

    await page.getByRole("button", { name: "Collapse" }).click();

    await expect(popupCard).toBeVisible();
    await expect(popupCard).toHaveAttribute("data-e2e-popup-instance", "tour-popup-before-collapse");
    await expect(popupCard).not.toHaveClass(/popup-card--compact/);
    await expect(popupCard.locator(".popup-card__eyebrow")).toContainText("Notables Tour 2020");
    await expect(popupCard.getByRole("button", { name: "Navigate" })).toBeVisible();
    await expect(popupCard.getByRole("button", { name: "Close" })).toBeVisible();
  });

  test("keyboard activation makes a tour stop authoritative in the sidebar", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("button", { name: "Tours", exact: true }).click();

    const tourInput = page.getByRole("combobox", { name: "Tour" });
    await tourInput.click();
    await page.getByRole("option", { name: "Notables Tour 2020" }).click();

    await expect(page.getByText("Loading Notables Tour 2020…")).toHaveCount(0, { timeout: 45_000 });

    const browseResults = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card");
    await expect(browseResults.first()).toBeVisible({ timeout: 45_000 });

    const selectedHeading = (await browseResults.first().getByRole("heading").textContent()).trim();
    const tourMarker = page.locator(".leaflet-marker-icon.tour-marker").first();
    const selectedSummary = page.locator(".left-sidebar__panel--selected-summary");
    await expect(tourMarker).toBeVisible();
    await tourMarker.focus();
    await expect(tourMarker).toBeFocused();

    await tourMarker.press("a");
    await expect(selectedSummary).toHaveCount(0);

    await tourMarker.press("Enter");

    const popupCard = page.locator(".leaflet-popup .popup-card");
    await expect(popupCard).toBeVisible();
    await expect(page.locator(".leaflet-popup .popup-card-stack")).toHaveCount(0);
    await expect(popupCard).toHaveClass(/popup-card--compact/);
    await expect(popupCard.getByRole("button", { name: "Navigate" })).toHaveCount(0);
    await expect(selectedSummary).toContainText(selectedHeading);
    await expect(selectedSummary.getByRole("button", { name: "Navigate" })).toBeVisible();
    await expect(page.locator(".selected-location-marker-icon")).toHaveCount(1);
  });

  test("a detached tour stop falls back to its retained selected marker popup", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("button", { name: "Tours", exact: true }).click();

    const tourInput = page.getByRole("combobox", { name: "Tour" });
    await tourInput.click();
    await page.getByRole("option", { name: "Notables Tour 2020" }).click();

    await expect(page.getByText("Loading Notables Tour 2020…")).toHaveCount(0, { timeout: 45_000 });

    const tourSearchInput = await getVisibleSearchInput(page);
    await tourSearchInput.fill("Harmanus Bleecker");

    // This unmatched stop stays source: "tour", which exercises the cached-layer fallback.
    const retainedTourStop = page
      .locator(".left-sidebar__panel--browse .left-sidebar__result-card")
      .filter({ has: page.getByRole("heading", { name: "Harmanus Bleecker", exact: true }) });
    await expect(retainedTourStop).toBeVisible({ timeout: 45_000 });
    await retainedTourStop.click();

    const selectedSummary = page.locator(".left-sidebar__panel--selected-summary");
    const selectedMarker = page.locator(".selected-location-marker-icon");
    await expect(selectedSummary).toContainText("Harmanus Bleecker");
    await expect(selectedMarker).toHaveCount(1);
    await expect(page.locator(".leaflet-popup .popup-card-stack")).toHaveCount(0);

    const tourBrowseDetail = page.locator(".left-sidebar__browse-detail--tour");
    await tourBrowseDetail.getByRole("button", { name: "Clear" }).click();

    await expect(tourInput).toHaveValue("");
    await expect(page.locator(".leaflet-marker-icon.tour-marker")).toHaveCount(0);
    await expect(selectedMarker).toHaveCount(1);
    await expect(selectedSummary).toContainText("Harmanus Bleecker");

    await selectedSummary.getByRole("button", { name: /Harmanus Bleecker/ }).click();

    const selectedMarkerPopup = page.locator(".leaflet-popup .popup-card-stack");
    await expect(selectedMarkerPopup).toBeVisible();
    await expect(selectedMarkerPopup.locator(".popup-card")).toHaveClass(/popup-card--compact/);
    await expect(selectedMarkerPopup).toContainText("Harmanus Bleecker");
  });

  test("deep links restore the selected burial and popup state", async ({ page }) => {
    await waitForAppReady(page, buildAppPath("view=burials&q=lamont"));

    const popupCard = page.locator(".popup-card");
    await expect(popupCard).toBeVisible({ timeout: 60_000 });
    await expect(popupCard.locator(".popup-card__title")).toHaveText("Thomas E LaMont");
    await expect(page.locator(".left-sidebar__panel--selected-summary")).toContainText("Thomas E LaMont");
  });

  test("packed shared links restore current burial data and landing state", async ({ page }) => {
    const sharedPacket = encodeSharePacketPayload({
      version: 1,
      name: "Lamont field check",
      note: "Confirm the shared selection restores from URL state.",
      activeBurialId: "burial:1:215:30:0",
      selectedRecords: [
        {
          id: "burial:1:215:30:0",
          source: "burial",
          displayName: "Stale Lamont Snapshot",
          Section: "215",
          Lot: "30",
          Tier: "0",
          Grave: "0",
          coordinates: [-73.736092, 42.712719],
        },
      ],
      sectionFilter: "215",
      mapBounds: [
        [42.712, -73.737],
        [42.713, -73.735],
      ],
    });

    await waitForAppReady(page, buildAppPath(`share=${sharedPacket}`));

    const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
    await expect(selectedPeoplePanel).toContainText("Thomas E LaMont", { timeout: 60_000 });
    await expect(selectedPeoplePanel).not.toContainText("Stale Lamont Snapshot");
    await expect(page.getByText("Opened from a shared link")).toBeVisible();
    await expect(page.getByText("Shared selection loaded from link.")).toBeVisible();
  });

  test("locate uses browser geolocation in the production map", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 42.70418,
      longitude: -73.73198,
    });

    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("button", { name: "Locate" }).click();

    await expect(page.getByText("Using your current location for directions.")).toBeVisible({ timeout: 15_000 });
  });

  test("locate does not stay pending when browser accuracy never becomes usable", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 42.70418,
      longitude: -73.73198,
      accuracy: 250,
    });

    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("button", { name: "Locate" }).click();

    await expect(page.getByText("Location is unavailable. Search by name or section, or open directions.")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Finding your location…")).toHaveCount(0);
  });

  test("on-map routing uses the local road graph", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 42.70418,
      longitude: -73.73198,
    });

    let externalRouteRequestCount = 0;
    page.on("request", (request) => {
      if (/valhalla|openrouteservice|graphhopper|mapbox.*directions/i.test(request.url())) {
        externalRouteRequestCount += 1;
      }
    });

    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);
    await primeOnSiteLocation(page);
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
    await selectedPeoplePanel.getByRole("button", { name: "Navigate" }).click();

    await expect(selectedPeoplePanel).toContainText("Route active");
    await expect(page.getByText("Calculating route…")).toHaveCount(0, { timeout: 15_000 });
    const routeLine = page.locator("path[stroke='#0f67c6']").first();
    await expect(routeLine).toBeVisible();
    expect(externalRouteRequestCount).toBe(0);

    await selectedPeoplePanel.getByRole("button", { name: "Stop Navigation" }).click();
    await expect(selectedPeoplePanel).not.toContainText("Route active");
  });

  test("active routing keeps updating after manual map drag without recentering", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 42.70418,
      longitude: -73.73198,
    });

    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);
    await primeOnSiteLocation(page);
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
    await selectedPeoplePanel.getByRole("button", { name: "Navigate" }).click();

    await expect(selectedPeoplePanel).toContainText("Route active");
    await expect(page.getByText("Calculating route…")).toHaveCount(0, { timeout: 15_000 });
    const routeLine = page.locator("path[stroke='#0f67c6']").first();
    await expect(routeLine).toBeVisible();

    const centeredMarker = await getSelectedMarkerCenter(page);
    await dragMapBy(page, { deltaX: 180, deltaY: -70 });
    const pannedMarker = await waitForStableSelectedMarkerCenter(page);
    expect(Math.abs(pannedMarker.x - centeredMarker.x)).toBeGreaterThan(20);

    const routePathBeforeRefresh = await routeLine.getAttribute("d");
    expect(routePathBeforeRefresh).toBeTruthy();

    await context.setGeolocation({
      latitude: 42.712719,
      longitude: -73.736092,
    });

    await expect(page.getByText("Calculating route…")).toHaveCount(0, { timeout: 15_000 });
    await expect(routeLine).toBeVisible();
    await expect.poll(() => routeLine.getAttribute("d"), {
      timeout: 15_000,
    }).not.toBe(routePathBeforeRefresh);
    const refreshedMarker = await waitForStableSelectedMarkerCenter(page);

    expect(Math.abs(refreshedMarker.x - pannedMarker.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(refreshedMarker.y - pannedMarker.y)).toBeLessThanOrEqual(3);
  });

  test("on-map routing explains when current location is off-site", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 40.7128,
      longitude: -74.006,
    });

    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
    await expectExternalMapsNavigation(page, () => selectedPeoplePanel.getByRole("button", { name: "Navigate" }).click());
  });
});

test.describe("mobile", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("a short shared plot stays attached to the bottom without hiding the map", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    const searchInput = await getVisibleSearchInput(page);
    await searchInput.fill("anna m gardiner waller");
    const wallerResult = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card")
      .filter({ hasText: "Anna M. Gardiner Waller" })
      .filter({ hasText: "Born 3/30/1834" })
      .filter({ hasText: "Died 9/6/1873" });
    await expect(wallerResult).toHaveCount(1);
    await wallerResult.click();

    await expect(page.locator(".leaflet-popup .popup-card")).toHaveCount(0);
    const selectedLocationMarker = page.locator(".selected-location-marker-icon");
    await expect(selectedLocationMarker).toHaveCount(1);
    await expect(selectedLocationMarker.locator(".cemetery-cluster__count")).toHaveText("4");

    await expect(page.getByRole("heading", { name: "Section 53 · Lot 7" })).toBeVisible();
    await expect(page.getByText("4 people at this plot", { exact: true })).toBeVisible();
    const locationCard = page.locator(".mobile-location-card");
    const pickerTrigger = locationCard.getByRole("button", {
      name: /Choose person.*Anna M\. Gardiner Waller selected.*4 people at this plot/i,
    });
    await expect(pickerTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(locationCard.getByRole("tablist")).toHaveCount(0);

    await pickerTrigger.click();

    const personList = locationCard.getByRole("listbox", {
      name: "Choose from 4 people at this plot",
    });
    const peopleOptions = personList.getByRole("option");
    await expect(peopleOptions).toHaveCount(4);
    await expect(personList.getByRole("option", { name: /Charles C Waller/i })).toBeVisible();
    await expect(personList.getByRole("option", { name: /Annie M\. Waller/i })).toBeVisible();
    const cyrenOption = personList.getByRole("option", { name: /Cyren C\. Waller/i });
    await expect(cyrenOption).toBeVisible();
    const activeOption = personList.getByRole("option", { name: /Anna M\. Gardiner Waller/i });
    await expect(activeOption).toHaveAttribute("aria-selected", "true");
    expect(await personList.evaluate((list) => list.scrollWidth <= list.clientWidth + 1)).toBe(true);
    expect(await peopleOptions.evaluateAll((options) => options.every((option) => {
      const name = option.querySelector(".mobile-location-card__person-option-name");
      return name && name.scrollWidth <= name.clientWidth + 1;
    }))).toBe(true);

    await cyrenOption.click();
    await expect(locationCard.getByRole("listbox")).toHaveCount(0);
    await expect(locationCard.getByRole("heading", { name: "Cyren C. Waller" })).toBeVisible();
    await expect(locationCard.getByRole("button", {
      name: /Choose person.*Cyren C\. Waller selected.*4 people at this plot/i,
    })).toHaveAttribute("aria-expanded", "false");

    const navigateButton = locationCard.getByRole("button", { name: "Navigate" });
    const detailsButton = locationCard.getByRole("button", { name: "Details" });
    await expectHitTarget(navigateButton);
    await expectHitTarget(detailsButton);

    await waitForSettledSheetTop(page.locator("[data-rsbs-overlay]"));

    const compactGeometry = await page.evaluate(() => {
      const overlay = document.querySelector("[data-rsbs-overlay]")?.getBoundingClientRect();
      const card = document.querySelector(".mobile-location-card")?.getBoundingClientRect();
      const markerElement = document.querySelector(".selected-location-marker-icon");
      const marker = markerElement?.getBoundingClientRect();
      const markerCenter = marker
        ? { x: marker.left + (marker.width / 2), y: marker.top + (marker.height / 2) }
        : null;
      const markerCenterElement = markerCenter
        ? document.elementFromPoint(markerCenter.x, markerCenter.y)
        : null;

      return {
        blankTail: overlay && card ? overlay.bottom - card.bottom : null,
        markerCenterVisible: Boolean(
          markerElement
          && markerCenterElement
          && (markerElement === markerCenterElement || markerElement.contains(markerCenterElement))
        ),
        markerCenterY: markerCenter?.y ?? null,
        sheetHeight: overlay?.height ?? null,
        sheetTop: overlay?.top ?? null,
        visibleMapHeight: overlay?.top ?? null,
        viewportHeight: window.innerHeight,
      };
    });

    expect(compactGeometry.sheetHeight).toBeLessThan(compactGeometry.viewportHeight * 0.62);
    expect(compactGeometry.visibleMapHeight).toBeGreaterThan(compactGeometry.viewportHeight * 0.4);
    expect(compactGeometry.blankTail).toBeLessThanOrEqual(70);
    expect(compactGeometry.markerCenterY).toBeLessThanOrEqual(compactGeometry.sheetTop - 8);
    expect(compactGeometry.markerCenterVisible).toBe(true);

    await detailsButton.click();
    await expect(locationCard.getByText("Records here")).toBeVisible();
    await expect.poll(async () => (
      await page.locator("[data-rsbs-overlay]").evaluate((overlay) => (
        overlay.getBoundingClientRect().height
      ))
    )).toBeGreaterThan(compactGeometry.sheetHeight);

    await detailsButton.click();
    await expect(locationCard.getByText("Records here")).toHaveCount(0);
    await expect.poll(async () => (
      await page.locator("[data-rsbs-overlay]").evaluate((overlay) => (
        overlay.getBoundingClientRect().height
      ))
    )).toBeLessThanOrEqual(compactGeometry.sheetHeight + 2);
  });

  test("one shared plot becomes one marker and one usable bottom location card", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    const searchInput = await getVisibleSearchInput(page);
    await searchInput.fill("marcus reynolds");
    const browseResults = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card");
    const unrelatedMarcus = browseResults
      .filter({ hasText: "Marcus T.11 Reynolds" })
      .filter({ hasText: "Born 2/17/1926" })
      .filter({ hasText: "Died 9/21/2007" });
    await expect(unrelatedMarcus).toHaveCount(1);
    await unrelatedMarcus.click();

    await expect(page.locator(".leaflet-popup .popup-card")).toHaveCount(0);

    const selectedLocationMarkers = page.locator(".selected-location-marker-icon");
    await expect(selectedLocationMarkers).toHaveCount(1);
    await expect(selectedLocationMarkers).toBeInViewport();
    await expect(selectedLocationMarkers.locator(".cemetery-cluster__count")).toHaveText("58");

    await expect(page.getByText("58 people at this plot", { exact: true })).toBeVisible();
    const locationCard = page.locator(".mobile-location-card");
    await expect(locationCard).toBeVisible();
    await expect(locationCard).toContainText("Marcus T.11 Reynolds");
    await expect(locationCard).toContainText("2/17/1926");
    await expect(locationCard).not.toContainText("Albany Architect");
    await expect(locationCard.locator(".left-sidebar__selected-place-visual-image")).toHaveCount(0);

    let pickerTrigger = locationCard.getByRole("button", { name: /Choose person/i });
    await pickerTrigger.click();

    let personList = locationCard.getByRole("listbox", {
      name: "Choose from 58 people at this plot",
    });
    const peopleOptions = personList.getByRole("option");
    const initialOptionCount = await peopleOptions.count();
    expect(initialOptionCount).toBe(58);
    await expect(personList.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
    expect(await personList.evaluate((list) => list.scrollWidth <= list.clientWidth + 1)).toBe(true);

    const pickerViewport = locationCard.locator(".mobile-location-card__person-picker-viewport");
    await expect.poll(() => pickerViewport.evaluate((viewport) => (
      viewport.scrollHeight > viewport.clientHeight
    ))).toBe(true);
    const sheetOverlay = page.locator("[data-rsbs-overlay]");
    const sheetTopBeforeSwipe = await waitForSettledSheetTop(sheetOverlay);
    await swipeElementUp(page, pickerViewport);
    await expect.poll(() => pickerViewport.evaluate((viewportElement) => (
      viewportElement.scrollTop
    ))).toBeGreaterThan(0);
    await expect(pickerTrigger).toHaveAttribute("aria-expanded", "true");
    const sheetTopAfterSwipe = await waitForSettledSheetTop(sheetOverlay);
    expect(Math.abs(sheetTopAfterSwipe - sheetTopBeforeSwipe)).toBeLessThanOrEqual(2);

    let peopleSearch = locationCard.getByRole("searchbox", { name: "Search people at this plot" });
    await peopleSearch.fill("Anne Reynolds");
    personList = locationCard.getByRole("listbox", {
      name: "Choose from 58 people at this plot",
    });
    const anneOption = personList.getByRole("option", { name: /^Anne Reynolds\./i });
    await expect(anneOption).toHaveCount(1);
    await peopleSearch.press("ArrowDown");
    await expect(anneOption).toBeFocused();
    await anneOption.press("Enter");

    await expect(locationCard.getByRole("listbox")).toHaveCount(0);
    await expect(locationCard.getByRole("heading", { name: "Anne Reynolds" })).toBeVisible();

    pickerTrigger = locationCard.getByRole("button", { name: /Choose person/i });
    await pickerTrigger.click();
    peopleSearch = locationCard.getByRole("searchbox", { name: "Search people at this plot" });
    await peopleSearch.fill("Marcus Tullius Reynolds");
    personList = locationCard.getByRole("listbox", {
      name: "Choose from 58 people at this plot",
    });
    const architectMarcus = personList.getByRole("option", {
      name: /^Marcus Tullius Reynolds\. Born 8\/20\/1869/i,
    });
    await expect(architectMarcus).toHaveCount(1);
    await architectMarcus.click();

    await expect(locationCard.getByRole("listbox")).toHaveCount(0);
    await expect(selectedLocationMarkers).toHaveCount(1);
    await expect(locationCard.getByRole("heading", { name: "Marcus Tullius Reynolds" })).toBeVisible();
    await expect(locationCard).toContainText("Albany Architect");

    const portrait = locationCard.locator(".left-sidebar__selected-place-visual-image");
    await expect(portrait).toBeVisible();
    await expect.poll(() => portrait.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);

    const navigateButton = locationCard.getByRole("button", { name: "Navigate" });
    await expectHitTarget(navigateButton);

    await page.getByRole("button", { name: "Back to results" }).click();
    await expect(locationCard).toHaveCount(0);
    await expect(selectedLocationMarkers).toHaveCount(0);
    await expect(await getVisibleSearchInput(page, { requireEditable: false })).toHaveValue("marcus reynolds");
  });

  test("short phones reveal Navigate without requiring another sheet drag", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    const searchInput = await getVisibleSearchInput(page);
    await searchInput.fill("marcus reynolds");
    const burialResult = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card")
      .filter({ hasText: "Marcus T.11 Reynolds" })
      .filter({ hasText: "Born 2/17/1926" });
    await expect(burialResult).toHaveCount(1);
    await burialResult.click();

    const locationCard = page.locator(".mobile-location-card");
    const navigateButton = locationCard.getByRole("button", { name: "Navigate" });
    await expect(locationCard).toBeVisible();
    await expectHitTarget(navigateButton);
  });
});
