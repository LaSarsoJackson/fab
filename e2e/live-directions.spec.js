import { expect, test } from "@playwright/test";

const GRAVE = "./?view=map&tour=Notable&record=tour%3ANotable%3A18%3A24%3A8";
const START = [-73.72586398734407, 42.709358811485714];
const installGps = async (page) => {
  await page.addInitScript(() => {
    globalThis.routeGps = { next: 0, watches: new Map(), cleared: [], calls: 0 };
    navigator.geolocation.getCurrentPosition = (success, failure) => { globalThis.routeGps.fix = success; globalThis.routeGps.failFix = failure; globalThis.routeGps.calls++; };
    navigator.geolocation.watchPosition = (success, failure) => {
      const id = ++globalThis.routeGps.next;
      globalThis.routeGps.watches.set(id, { success, failure });
      globalThis.routeGps.last = { success, failure };
      return id;
    };
    navigator.geolocation.clearWatch = (id) => { globalThis.routeGps.cleared.push(id); globalThis.routeGps.watches.delete(id); };
  });
};
const deliver = async (page, coordinates = START, accuracy = 8) => page.evaluate(({ coordinates, accuracy }) => {
  const position = { coords: { longitude: coordinates[0], latitude: coordinates[1], accuracy }, timestamp: Date.now() };
  globalThis.routeGps.last.success(position);
}, { coordinates, accuracy });
const open = async (page) => {
  await page.goto(GRAVE);
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  return page.getByRole("complementary", { name: "Cemetery directions" });
};

test("explicit following updates a local route without stealing focus or announcing each fix", async ({ page }, testInfo) => {
  await installGps(page);
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  const panel = await open(page);
  expect(await page.evaluate(() => globalThis.routeGps.watches.size)).toBe(0);
  await panel.getByRole("button", { name: "Start from my location", exact: true }).click();
  await page.evaluate((coordinates) => globalThis.routeGps.fix({ coords: { longitude: coordinates[0], latitude: coordinates[1], accuracy: 8 }, timestamp: Date.now() }), START);
  await expect(panel).toContainText("along mapped roads");
  await panel.getByRole("button", { name: "Follow my location", exact: true }).click();
  await deliver(page);
  await expect(panel.getByRole("button", { name: "Stop following", exact: true })).toBeVisible();
  await expect(panel.getByRole("status")).toHaveText("Following your location.");
  const status = await panel.getByRole("status").innerText();
  const initialDistance = await panel.locator(".map-route-distance").innerText();
  await panel.getByRole("button", { name: /^To / }).focus();
  await page.waitForTimeout(2100);
  await deliver(page, [-73.7263, 42.7093]);
  await expect(panel.getByRole("button", { name: /^To / })).toBeFocused();
  await expect(panel.getByRole("status")).toHaveText(status);
  await expect(panel.locator(".map-route-distance")).not.toHaveText(initialDistance);
  await expect(panel).toContainText("±8 m");
  await panel.getByRole("button", { name: "Stop following", exact: true }).click();
  expect(await page.evaluate(() => globalThis.routeGps.watches.size)).toBe(0);
  await deliver(page, [-73.73, 42.707]);
  await expect(panel).toContainText("last position");
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  for (const text of [page.url(), storage, ...requests]) {
    expect(text).not.toContain("42.709358");
    expect(text).not.toContain("-73.725863");
  }
  await testInfo.attach("directions-following", { body: await page.screenshot(), contentType: "image/png" });
});

for (const action of ["close", "manual start", "manual destination", "leave map"]) {
  test(`following stops on ${action} and ignores late GPS callbacks`, async ({ page }) => {
    await installGps(page);
    const panel = await open(page);
    await panel.getByRole("button", { name: /^From / }).click();
    await panel.getByRole("button", { name: "Use my location", exact: true }).click();
    await page.evaluate((coordinates) => globalThis.routeGps.fix({ coords: { longitude: coordinates[0], latitude: coordinates[1], accuracy: 8 }, timestamp: Date.now() }), START);
    await panel.getByRole("button", { name: "Follow my location", exact: true }).click();
    await deliver(page);
    if (action === "close") await panel.getByRole("button", { name: "Close route", exact: true }).click();
    if (action === "leave map") await page.getByRole("button", { name: "Burial Locator", exact: true }).click();
    if (action.startsWith("manual")) {
      await panel.getByRole("button", { name: action.endsWith("start") ? /^From / : /^To / }).click();
      await panel.getByRole("button", { name: "Choose on map", exact: true }).click();
    }
    expect(await page.evaluate(() => globalThis.routeGps.watches.size)).toBe(0);
    await deliver(page);
    if (action === "close") await expect(panel).toHaveCount(0);
    if (action.startsWith("manual")) await expect(panel).toContainText("Tap the map");
  });
}

test("poor GPS and denied permission keep endpoint choices available", async ({ page }) => {
  await installGps(page);
  const panel = await open(page);
  await panel.getByRole("button", { name: "Start from my location", exact: true }).click();
  await page.evaluate(() => globalThis.routeGps.failFix({ code: 1 }));
  await expect(panel.getByRole("alert")).toContainText("Location is blocked");
  await panel.getByRole("button", { name: "Start from my location", exact: true }).click();
  await page.evaluate((coordinates) => globalThis.routeGps.fix({ coords: { longitude: coordinates[0], latitude: coordinates[1], accuracy: 8 }, timestamp: Date.now() }), START);
  await panel.getByRole("button", { name: "Follow my location", exact: true }).click();
  await deliver(page);
  await deliver(page, [-73.73, 42.707], 200);
  await expect(panel.getByRole("status")).toContainText("too imprecise");
  await page.evaluate(() => globalThis.routeGps.last.failure({ code: 1 }));
  await expect(panel.getByRole("alert")).toContainText("Location is blocked");
  expect(await page.evaluate(() => globalThis.routeGps.watches.size)).toBe(0);
  await panel.getByRole("button", { name: /^To / }).click();
  await expect(panel.getByRole("button", { name: "Choose on map", exact: true })).toBeVisible();
});

test("stale following is disclosed and recovers only with a fresh accurate fix", async ({ page }) => {
  await installGps(page);
  const panel = await open(page);
  await panel.getByRole("button", { name: "Start from my location", exact: true }).click();
  await page.evaluate((coordinates) => globalThis.routeGps.fix({ coords: { longitude: coordinates[0], latitude: coordinates[1], accuracy: 8 }, timestamp: Date.now() }), START);
  await panel.getByRole("button", { name: "Follow my location", exact: true }).click();
  await deliver(page);
  await page.waitForTimeout(25000);
  await expect(panel.getByRole("status")).toContainText("isn't updating");
  await deliver(page);
  await expect(panel.getByRole("status")).toContainText("Following your location");
});

for (const viewport of [{ width: 375, height: 812 }, { width: 750, height: 342 }]) {
  test(`keyboard endpoint list and visible controls at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const panel = await open(page);
    const to = panel.getByRole("button", { name: /^To / });
    await to.focus();
    await to.press("Enter");
    await expect(to).toHaveAttribute("aria-expanded", "true");
    await panel.getByRole("button", { name: "Choose on map", exact: true }).press("Escape");
    await expect(to).toBeFocused();
    await panel.getByRole("button", { name: /^From / }).press("Enter");
    await panel.getByRole("button", { name: "Choose from list", exact: true }).press("Enter");
    const places = panel.getByRole("combobox", { name: "Mapped place" });
    const graveValue = await places.locator("option").filter({ hasText: "Chester" }).first().getAttribute("value");
    await places.selectOption(graveValue);
    await panel.getByRole("button", { name: "Set start", exact: true }).press("Enter");
    await expect(panel).toContainText("along mapped roads");
    await expect(panel.getByRole("button", { name: "Close route", exact: true })).toBeInViewport();
    await expect(panel.getByRole("button", { name: "Follow my location", exact: true })).toBeInViewport();
    expect(await page.locator("h2").first().evaluate((h) => getComputedStyle(h).fontFamily)).not.toMatch(/Newsreader|Georgia/);
    await testInfo.attach(`keyboard-${viewport.width}`, { body: await page.screenshot(), contentType: "image/png" });
  });
}

test("pagehide clears live directions and late positions cannot restart them", async ({ page }) => {
  await installGps(page);
  const panel = await open(page);
  await panel.getByRole("button", { name: "Start from my location", exact: true }).click();
  await page.evaluate((coordinates) => globalThis.routeGps.fix({ coords: { longitude: coordinates[0], latitude: coordinates[1], accuracy: 8 }, timestamp: Date.now() }), START);
  await panel.getByRole("button", { name: "Follow my location", exact: true }).click();
  await deliver(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  expect(await page.evaluate(() => globalThis.routeGps.watches.size)).toBe(0);
  await deliver(page);
  await expect(panel.getByRole("button", { name: "Stop following", exact: true })).toHaveCount(0);
});

test("keyboard map picking confirms the visible crosshair and restores endpoint focus", async ({ page }, testInfo) => {
  const panel = await open(page);
  await panel.getByRole("button", { name: /^From / }).press("Enter");
  await panel.getByRole("button", { name: "Choose on map", exact: true }).press("Enter");
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.focus();
  await canvas.press("ArrowLeft");
  const confirm = page.getByRole("button", { name: "Set start here", exact: true });
  await expect(confirm).toBeInViewport();
  await confirm.press("Enter");
  await expect(panel.getByRole("button", { name: /^From Map start/ })).toBeFocused();
  await testInfo.attach("keyboard-crosshair", { body: await page.screenshot(), contentType: "image/png" });
});

test("a valid fix outside mapped roads removes the old route and keeps the destination", async ({ page }) => {
  await installGps(page);
  const panel = await open(page);
  await panel.getByRole("button", { name: "Start from my location", exact: true }).click();
  await page.evaluate((coordinates) => globalThis.routeGps.fix({ coords: { longitude: coordinates[0], latitude: coordinates[1], accuracy: 8 }, timestamp: Date.now() }), START);
  await expect(panel).toContainText("along mapped roads");
  await panel.getByRole("button", { name: "Follow my location", exact: true }).click();
  await deliver(page, [-74, 43]);
  await expect(panel.getByRole("alert")).toContainText("within 100 m");
  await expect(panel.locator(".map-route-result")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^To .*Chester/ })).toBeVisible();
});

for (const [width, height, visibleMapWidth] of [[750, 342, 400], [568, 320, 200]]) {
  test(`short landscape fully shows both endpoint rows at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await installGps(page);
    const panel = await open(page);
    const content = await panel.locator(".map-route-panel__content").boundingBox();
    for (const row of [panel.getByRole("button", { name: /^From / }), panel.getByRole("button", { name: /^To / })]) {
      await expect(row).toBeInViewport({ ratio: 0.99 });
      const box = await row.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(content.y);
      expect(box.y + box.height).toBeLessThanOrEqual(content.y + content.height);
    }
    const box = await panel.boundingBox();
    const map = await page.locator(".map-page").boundingBox();
    const toolbar = await page.locator(".map-toolbar").boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(map.y);
    expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height);
    expect(toolbar.x).toBeGreaterThanOrEqual(box.x + box.width);
    expect(map.width - (box.x + box.width - map.x)).toBeGreaterThanOrEqual(visibleMapWidth);
    for (const button of [panel.getByRole("button", { name: "Start from my location", exact: true }), panel.getByRole("button", { name: "Close route", exact: true })]) {
      await expect(button).toBeInViewport({ ratio: 0.99 });
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    await panel.getByRole("button", { name: "Start from my location", exact: true }).click();
    await page.evaluate((coordinates) => globalThis.routeGps.fix({ coords: { longitude: coordinates[0], latitude: coordinates[1], accuracy: 8 }, timestamp: Date.now() }), START);
    await panel.getByRole("button", { name: "Follow my location", exact: true }).click();
    await deliver(page);
    for (const row of [panel.getByRole("button", { name: /^From / }), panel.getByRole("button", { name: /^To / }), panel.locator(".map-route-distance")]) await expect(row).toBeInViewport({ ratio: 0.99 });
    await testInfo.attach(`landscape-visible-${width}`, { body: await page.screenshot(), contentType: "image/png" });
  });
}
