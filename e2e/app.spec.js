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
  const browseSearchInput = page.locator(".left-sidebar__browse-composer input").first();
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
  await expect(page.getByText("Preparing fast search…")).toHaveCount(0);

  return browseResults;
}

async function openDirectionsMenu(
  scope,
  page,
  { buttonName = "Directions", routeActionName = "Route on Map" } = {}
) {
  await scope.getByRole("button", { name: buttonName }).first().click();
  await expect(page.getByRole("menuitem", { name: routeActionName })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Open in Maps" })).toBeVisible();
}

async function expectExternalMapsNavigation(page, triggerNavigation) {
  const externalMapsPattern = /maps\.apple\.com|google\.com\/maps\/dir/i;
  const popupPromise = page
    .waitForEvent("popup", { timeout: 20_000 })
    .then((popup) => ({ type: "popup", popup }));
  const sameTabNavigationPromise = page
    .waitForURL(externalMapsPattern, { timeout: 20_000 })
    .then(() => ({ type: "same-tab" }));

  await triggerNavigation();

  let navigationTarget = null;

  try {
    navigationTarget = await Promise.any([popupPromise, sameTabNavigationPromise]);
  } catch (error) {
    throw new Error("Expected Open in Maps to launch Apple Maps or Google Maps.");
  }

  if (navigationTarget.type === "popup") {
    await navigationTarget.popup.waitForLoadState("domcontentloaded");
    await expect(navigationTarget.popup).toHaveURL(externalMapsPattern, { timeout: 20_000 });
    await navigationTarget.popup.close();
    return;
  }

  await expect(page).toHaveURL(externalMapsPattern, { timeout: 20_000 });
}

async function getSelectedMarkerCenter(page) {
  const marker = page.locator(".custom-div-icon").first();
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

test.describe("desktop", () => {
  test("searching for a burial opens the map popup and external maps popup", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const popupCard = page.locator(".popup-card");
    await expect(popupCard).toBeVisible();
    await expect(popupCard.locator(".popup-card__title")).toHaveText("Thomas E LaMont");
    await expect(popupCard.locator(".popup-card__details")).toContainText("Section 215, Lot 30, Tier 0, Grave 0");

    await openDirectionsMenu(popupCard, page);
    await expectExternalMapsNavigation(page, () => page.getByRole("menuitem", { name: "Open in Maps" }).click());
  });

  test("desktop search panel can be hidden and restored", async ({ page }) => {
    await waitForAppReady(page);

    await expect(page.locator(".left-sidebar--desktop")).toBeVisible();
    await page.getByRole("button", { name: "Hide search panel" }).click();

    await expect(page.locator(".left-sidebar--desktop")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show search panel" })).toBeVisible();

    await page.getByRole("button", { name: "Show search panel" }).click();
    await expect(page.locator(".left-sidebar--desktop")).toBeVisible();
    await expect(await getVisibleSearchInput(page, { requireEditable: false })).toBeVisible();
  });

  test("section browsing shows section-scoped results and can be cleared", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("group", { name: "Browse the map" }).getByRole("button", { name: "Sections", exact: true }).click();
    const sectionBrowseDetail = page.locator(".left-sidebar__browse-detail--section");
    const browseSearchInput = page.locator(".left-sidebar__browse-composer input").first();

    await expect(sectionBrowseDetail).toContainText(/one section, then refine inside it\./i);

    const sectionInput = page.getByRole("combobox", { name: "Section" });
    await sectionInput.click();
    await sectionInput.fill("215");
    await page.getByRole("option", { name: "Section 215" }).click();
    await expect(sectionInput).toHaveValue("Section 215");
    await expect(browseSearchInput).toHaveAttribute("placeholder", "Search this section");
    await expect(sectionBrowseDetail).toContainText("Refine Section 215");

    const markerToggle = sectionBrowseDetail.getByRole("button", { name: /section markers/i });
    await expect(markerToggle).toBeVisible();
    const startingLabel = (await markerToggle.textContent()) || "";
    await markerToggle.click();
    await expect(sectionBrowseDetail.getByRole("button", {
        name: startingLabel.includes("Hide") ? "Show section markers" : "Hide section markers",
    })).toBeVisible();

    const browseResults = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card");
    await expect(page.locator(".left-sidebar__panel--browse")).toContainText(/Showing \d+ of \d+/);
    await browseResults.first().click();

    await expect(page.locator(".popup-card")).toBeVisible();

    await sectionBrowseDetail.getByRole("button", { name: "Clear" }).click();
    await expect(sectionInput).toHaveValue("");
    await expect(browseSearchInput).toHaveAttribute("placeholder", "Select a section to browse");
    await expect(sectionBrowseDetail).not.toContainText("Refine Section 215");
    await expect(page.getByRole("button", { name: "Show section markers" })).toHaveCount(0);
  });

  test("tour browsing loads stops and lets a user inspect a tour stop popup", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("group", { name: "Browse the map" }).getByRole("button", { name: "Tours", exact: true }).click();

    const tourInput = page.getByRole("combobox", { name: "Tour" });
    await tourInput.click();
    await tourInput.fill("Notables");
    await page.getByRole("option", { name: "Notables Tour 2020" }).click();

    await expect(page.getByText("Loading Notables Tour 2020…")).toHaveCount(0, { timeout: 45_000 });

    const browseResults = page.locator(".left-sidebar__panel--browse .left-sidebar__result-card");
    await expect(browseResults.first()).toBeVisible();

    const selectedHeading = (await browseResults.first().getByRole("heading").textContent()).trim();
    await browseResults.first().click();

    const popupCard = page.locator(".popup-card");
    await expect(popupCard).toBeVisible();
    await expect(popupCard.locator(".popup-card__eyebrow")).toContainText("Notables Tour 2020");
    await expect(popupCard.locator(".popup-card__title")).toHaveText(selectedHeading);
  });

  test("deep links restore the selected burial and popup state", async ({ page }) => {
    await waitForAppReady(page, buildAppPath("view=burials&q=lamont"));

    const popupCard = page.locator(".popup-card");
    await expect(popupCard).toBeVisible({ timeout: 60_000 });
    await expect(popupCard.locator(".popup-card__title")).toHaveText("Thomas E LaMont");
    await expect(page.locator(".left-sidebar__panel--selected-summary")).toContainText("Thomas E LaMont");
  });

  test("locate uses browser geolocation in the production map", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 42.70418,
      longitude: -73.73198,
    });

    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("button", { name: "My location" }).click();

    await expect(page.getByText("Using your current location for directions.")).toBeVisible({ timeout: 15_000 });
  });

  test("locate does not stay pending when browser accuracy never becomes usable", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 42.70418,
      longitude: -73.73198,
      accuracy: 250,
    });

    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);

    await page.getByRole("button", { name: "My location" }).click();

    await expect(page.getByText("GPS is unavailable. Check signal and permissions, or search by name or section.")).toBeVisible({ timeout: 25_000 });
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
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
    await openDirectionsMenu(selectedPeoplePanel, page);
    await page.getByRole("menuitem", { name: "Route on Map" }).click();

    await expect(selectedPeoplePanel).toContainText("Route active");
    await expect(page.getByText("Calculating route...")).toHaveCount(0, { timeout: 15_000 });
    const routeLine = page.locator("path[stroke='#0f67c6']").first();
    await expect(routeLine).toBeVisible();
    await expect(page.locator("path[stroke='#26333b']").first()).toBeVisible();
    const initialRoutePath = await routeLine.getAttribute("d");
    expect(externalRouteRequestCount).toBe(0);

    await context.setGeolocation({
      latitude: 42.7051,
      longitude: -73.7304,
    });
    await expect(routeLine).not.toHaveAttribute("d", initialRoutePath || "", { timeout: 15_000 });

    await openDirectionsMenu(selectedPeoplePanel, page, { routeActionName: "Stop Route" });
    await page.getByRole("menuitem", { name: "Stop Route" }).click();
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
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
    await openDirectionsMenu(selectedPeoplePanel, page);
    await page.getByRole("menuitem", { name: "Route on Map" }).click();

    await expect(selectedPeoplePanel).toContainText("Route active");
    await expect(page.getByText("Calculating route...")).toHaveCount(0, { timeout: 15_000 });
    const routeLine = page.locator("path[stroke='#0f67c6']").first();
    await expect(routeLine).toBeVisible();

    const centeredMarker = await getSelectedMarkerCenter(page);
    await dragMapBy(page, { deltaX: 180, deltaY: -70 });
    const pannedMarker = await getSelectedMarkerCenter(page);
    expect(Math.abs(pannedMarker.x - centeredMarker.x)).toBeGreaterThan(20);

    const routePathAfterPan = await routeLine.getAttribute("d");
    await context.setGeolocation({
      latitude: 42.7051,
      longitude: -73.7304,
    });

    await expect(routeLine).not.toHaveAttribute("d", routePathAfterPan || "", { timeout: 15_000 });
    await expect(page.getByText("Calculating route...")).toHaveCount(0, { timeout: 15_000 });
    const refreshedMarker = await getSelectedMarkerCenter(page);

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
    await openDirectionsMenu(selectedPeoplePanel, page);
    await page.getByRole("menuitem", { name: "Route on Map" }).click();

    await expect(page.getByText(/Route on Map needs your current location near Albany Rural Cemetery/i)).toBeVisible({ timeout: 15_000 });
    await expect(selectedPeoplePanel).not.toContainText("Route active");
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("selected-person actions stay usable in the mobile bottom sheet", async ({ page }) => {
    await waitForAppReady(page);
    await ensureBurialDataLoaded(page);
    const browseResults = await searchForLamont(page);

    await browseResults.first().click();

    const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
    await expect(selectedPeoplePanel).toContainText("Selection");
    await expect(selectedPeoplePanel).toContainText("Pinned for focus & directions");
    await expect(selectedPeoplePanel).toContainText("Thomas E LaMont");
    await expect(selectedPeoplePanel.getByRole("button", { name: "Route on map" })).toBeVisible();
    await expect(selectedPeoplePanel.getByRole("button", { name: "Open in Maps" })).toBeVisible();
    await expect(selectedPeoplePanel.getByRole("button", { name: "Route on map" })).toBeInViewport();
    await expect(selectedPeoplePanel.getByRole("button", { name: "Open in Maps" })).toBeInViewport();

    await selectedPeoplePanel.getByRole("button", { name: "Clear" }).click();
    await expect(selectedPeoplePanel).toHaveCount(0);
  });
});
