import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.mapErrors = [];
  page.on("pageerror", (error) => testInfo.mapErrors.push(error.message));
  page.on("console", (message) => {
    if (message.text().includes("Map cannot fit within canvas")) testInfo.mapErrors.push(message.text());
  });
});
test.afterEach(async ({ page: _page }, testInfo) => { expect(testInfo.mapErrors).toEqual([]); });

const GRAVE = "./?view=map&tour=Notable&record=tour%3ANotable%3A18%3A24%3A8";
const observeMap = async (page) => {
  await page.route(/\/src\/features\/map\/MapView\.jsx(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("mapRef.current = map;", "mapRef.current = map; globalThis.testMap = map;") });
  });
};
const mapPoint = async (page, point) => {
  await page.waitForFunction(() => globalThis.testMap?.loaded() && !globalThis.testMap.isMoving());
  await page.evaluate((coordinate) => globalThis.testMap.jumpTo({ center: coordinate, zoom: 17, padding: { top: 0, bottom: 130, left: 0, right: 0 } }), point);
  return page.evaluate((coordinate) => {
    const point = globalThis.testMap.project(coordinate);
    return { x: point.x, y: point.y };
  }, point);
};

test("route to a grave uses GPS, draws roads and gaps, and closes cleanly", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 42.709358811485714, longitude: -73.72586398734407, accuracy: 8 });
  await observeMap(page);
  await page.goto(GRAVE);
  await page.getByRole("button", { name: "Route here", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Cemetery route" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Chester");
  await expect(page.locator(".record-card")).toHaveCount(0);
  await panel.getByRole("button", { name: "Use my location" }).click();
  await expect(panel.getByRole("status")).toContainText("along mapped roads");
  await expect.poll(() => page.evaluate(() => globalThis.testMap.queryRenderedFeatures({ layers: ["local-road-route"] }).length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => globalThis.testMap.queryRenderedFeatures({ layers: ["local-route-gaps"] }).length)).toBeGreaterThan(0);
  expect(new URL(page.url()).searchParams.has("from")).toBe(false);
  await panel.getByRole("button", { name: "Close route" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".record-card")).toBeVisible();
  await expect(page.getByRole("button", { name: "Route here", exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => globalThis.testMap.queryRenderedFeatures({ layers: ["local-road-route"] }).length)).toBe(0);
});

for (const viewport of [{ width: 375, height: 812 }, { width: 750, height: 342 }]) {
  test(`map-picked routing preserves ordinary map selection at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await observeMap(page);
    await page.goto("./?view=map");
    await page.getByRole("button", { name: "Plan route" }).click();
    const panel = page.getByRole("complementary", { name: "Cemetery route" });
    await panel.getByRole("button", { name: "Choose start on map" }).click();
    await expect(panel).toContainText("Tap the map");
    const before = page.url();
    await page.locator(".maplibregl-canvas").click({ position: await mapPoint(page, [-73.72586398734407, 42.709358811485714]) });
    await expect(panel).toContainText("Map start");
    await panel.getByRole("button", { name: "Choose destination on map" }).click();
    await page.locator(".maplibregl-canvas").click({ position: await mapPoint(page, [-73.73362297435509, 42.707493868452055]) });
    await expect(panel.getByRole("status")).toContainText("along mapped roads");
    await expect(page).toHaveURL(before);
    await expect(panel.getByRole("button", { name: "Close route" })).toBeInViewport();
    await testInfo.attach("local-route", { body: await page.screenshot(), contentType: "image/png" });
    await panel.getByRole("button", { name: "Close route" }).click();
    await expect(page.getByRole("button", { name: "Plan route" })).toBeFocused();
    await page.locator(".maplibregl-canvas").click({ position: await mapPoint(page, [-73.73362297435509, 42.707493868452055]) });
    await expect(page.getByRole("group", { name: "Section 24", exact: true })).toBeVisible();
  });
}

test("denied and imprecise GPS leave map-picking available", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 });
  });
  await page.goto(GRAVE);
  await page.getByRole("button", { name: "Route here", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Cemetery route" });
  await panel.getByRole("button", { name: "Use my location" }).click();
  await expect(panel.getByRole("alert")).toContainText("Location is blocked");
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (success) => success({ coords: { latitude: 42.70749, longitude: -73.73362, accuracy: 200 }, timestamp: Date.now() });
  });
  await panel.getByRole("button", { name: "Use my location" }).click();
  await expect(panel.getByRole("alert")).toContainText("too imprecise");
  await panel.getByRole("button", { name: "Choose start on map" }).click();
  await expect(panel).toContainText("Tap the map");
});

test("a late GPS result cannot overwrite a map-pick or reopen a closed route", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) => { globalThis.deliverRouteLocation = success; };
  });
  await page.goto(GRAVE);
  await page.getByRole("button", { name: "Route here", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Cemetery route" });
  await panel.getByRole("button", { name: "Use my location" }).click();
  await panel.getByRole("button", { name: "Choose start on map" }).click();
  await page.evaluate(() => globalThis.deliverRouteLocation({ coords: { latitude: 42.70749, longitude: -73.73362, accuracy: 5 }, timestamp: Date.now() }));
  await expect(panel).toContainText("Tap the map");
  await panel.getByRole("button", { name: "Close route" }).click();
  await page.evaluate(() => globalThis.deliverRouteLocation({ coords: { latitude: 42.70749, longitude: -73.73362, accuracy: 5 }, timestamp: Date.now() }));
  await expect(panel).toHaveCount(0);
});
