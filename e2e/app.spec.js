const { test, expect } = require("@playwright/test");

const TEST_APP_PORT = process.env.PLAYWRIGHT_APP_PORT || "4173";
const TEST_IMAGE_PORT = process.env.PLAYWRIGHT_IMAGE_PORT || "8173";
const APP_HOSTS = new Set([
  `127.0.0.1:${TEST_APP_PORT}`,
  `localhost:${TEST_APP_PORT}`,
  `127.0.0.1:${TEST_IMAGE_PORT}`,
  `localhost:${TEST_IMAGE_PORT}`,
]);

const runtimeVariants = [
  { name: "leaflet", path: "/" },
  { name: "custom-map", path: "/?mapEngine=custom" },
];
const isIgnorableConsoleError = (text = "") => /^Failed to load resource:/i.test(text);
const buildRuntimePath = (runtimePath, searchParams = "") => {
  if (!searchParams) {
    return runtimePath;
  }

  const separator = runtimePath.includes("?") ? "&" : "?";
  return `${runtimePath}${separator}${searchParams}`;
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

async function waitForAppReady(page, path = "/") {
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

  const browseResults = page.locator(".left-sidebar__panel--browse li");
  await expect(browseResults.first()).toContainText("Thomas E LaMont");

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

runtimeVariants.forEach((runtimeVariant) => {
  test.describe(`desktop (${runtimeVariant.name})`, () => {
    test("searching for a burial opens the map popup and external maps popup", async ({ page }) => {
      await waitForAppReady(page, runtimeVariant.path);
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

    test("section browsing shows section-scoped results and can be cleared", async ({ page }) => {
      await waitForAppReady(page, runtimeVariant.path);
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

      const browseResults = page.locator(".left-sidebar__panel--browse li");
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
      await waitForAppReady(page, runtimeVariant.path);
      await ensureBurialDataLoaded(page);

      await page.getByRole("group", { name: "Browse the map" }).getByRole("button", { name: "Tours", exact: true }).click();

      const tourInput = page.getByRole("combobox", { name: "Tour" });
      await tourInput.click();
      await tourInput.fill("Notables");
      await page.getByRole("option", { name: "Notables Tour 2020" }).click();

      await expect(page.getByText("Loading Notables Tour 2020…")).toHaveCount(0, { timeout: 45_000 });

      const browseResults = page.locator(".left-sidebar__panel--browse li");
      await expect(browseResults.first()).toBeVisible();

      const selectedHeading = (await browseResults.first().getByRole("heading").textContent()).trim();
      await browseResults.first().click();

      const popupCard = page.locator(".popup-card");
      await expect(popupCard).toBeVisible();
      await expect(popupCard.locator(".popup-card__eyebrow")).toContainText("Notables Tour 2020");
      await expect(popupCard.locator(".popup-card__title")).toHaveText(selectedHeading);
    });

    test("deep links restore the selected burial and popup state", async ({ page }) => {
      await waitForAppReady(page, buildRuntimePath(runtimeVariant.path, "view=burials&q=lamont"));

      const popupCard = page.locator(".popup-card");
      await expect(popupCard).toBeVisible({ timeout: 60_000 });
      await expect(popupCard.locator(".popup-card__title")).toHaveText("Thomas E LaMont");
      await expect(page.locator(".left-sidebar__panel--selected-summary")).toContainText("Thomas E LaMont");
    });

    test("locate uses browser geolocation in both runtimes", async ({ page, context }) => {
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({
        latitude: 42.70418,
        longitude: -73.73198,
      });

      await waitForAppReady(page, runtimeVariant.path);
      await ensureBurialDataLoaded(page);

      await page.getByRole("button", { name: "My location" }).click();

      await expect(page.getByText("Using your current location for directions.")).toBeVisible({ timeout: 15_000 });
    });

    test("on-map routing uses the shared route flow in both runtimes", async ({ page, context }) => {
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({
        latitude: 42.70418,
        longitude: -73.73198,
      });

      let routeRequestCount = 0;
      await page.route(/valhalla1\.openstreetmap\.de\/route/, async (route) => {
        routeRequestCount += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            code: "Ok",
            routes: [
              {
                distance: 412.7,
                duration: 301,
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [-73.73198, 42.70418],
                    [-73.72994, 42.70551],
                    [-73.72812, 42.70674],
                  ],
                },
              },
            ],
          }),
        });
      });

      await waitForAppReady(page, runtimeVariant.path);
      await ensureBurialDataLoaded(page);
      const browseResults = await searchForLamont(page);

      await browseResults.first().click();

      const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
      await openDirectionsMenu(selectedPeoplePanel, page);
      await page.getByRole("menuitem", { name: "Route on Map" }).click();

      await expect(selectedPeoplePanel).toContainText("Route active");
      await expect.poll(() => routeRequestCount).toBe(1);
      await expect(page.getByText("Calculating route...")).toHaveCount(0, { timeout: 15_000 });

      await openDirectionsMenu(selectedPeoplePanel, page, { routeActionName: "Stop Route" });
      await page.getByRole("menuitem", { name: "Stop Route" }).click();
      await expect(selectedPeoplePanel).not.toContainText("Route active");
    });
  });
});

runtimeVariants.forEach((runtimeVariant) => {
  test.describe(`mobile (${runtimeVariant.name})`, () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("selected-person actions stay usable in the mobile bottom sheet", async ({ page }) => {
      await waitForAppReady(page, runtimeVariant.path);
      await ensureBurialDataLoaded(page);
      const browseResults = await searchForLamont(page);

      await browseResults.first().click();

      const selectedPeoplePanel = page.locator(".left-sidebar__panel--selected-summary");
      await expect(selectedPeoplePanel).toContainText("Selection");
      await expect(selectedPeoplePanel).toContainText("Pinned for focus & directions");
      await expect(selectedPeoplePanel).toContainText("Thomas E LaMont");
      await expect(selectedPeoplePanel.getByRole("button", { name: "Route on map" })).toBeVisible();
      await expect(selectedPeoplePanel.getByRole("button", { name: "Open in Maps" })).toBeVisible();

      await selectedPeoplePanel.getByRole("button", { name: "Clear" }).click();
      await expect(selectedPeoplePanel).toHaveCount(0);
    });
  });
});
