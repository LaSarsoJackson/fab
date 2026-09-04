import { expect, test } from "@playwright/test";

// Observe the real map in the test browser without shipping a global test hook.
const observeMap = async (page) => {
  await page.route(/\/src\/features\/map\/MapView\.jsx(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const assignment = "mapRef.current = map;";
    expect(source).toContain(assignment);
    await route.fulfill({
      response,
      body: source.replace(assignment, `${assignment} globalThis.testMap = map;`),
    });
  });
};

const waitForMap = async (page) => {
  await page.waitForFunction(() => (
    globalThis.testMap?.loaded() && !globalThis.testMap.isMoving()
  ));
};

const canvasPixels = (page) => page.evaluate(() => new Promise((resolve) => {
  const map = globalThis.testMap;
  map.once("render", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 120;
    const context = canvas.getContext("2d");
    context.drawImage(map.getCanvas(), 0, 0, 120, 120);
    resolve(Array.from(context.getImageData(0, 0, 120, 120).data));
  });
  map.triggerRepaint();
}));

for (const width of [375, 1440]) {
  test(`terrain and landmark names render without intercepting section taps at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    const fontRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/\.pbf(?:\?|$)|\.woff2?(?:\?|$)/.test(request.url())) fontRequests.push(request.url());
    });
    await observeMap(page);
    await page.goto("./?view=map&section=49");
    await waitForMap(page);
    await page.evaluate(() => globalThis.testMap.jumpTo({
      center: [-73.73362, 42.70749], zoom: 16.8,
    }));
    await waitForMap(page);
    await expect.poll(() => page.evaluate(() => (
      globalThis.testMap.queryRenderedFeatures({ layers: ["cemetery-landmark-labels"] })
        .map(({ properties }) => properties.Full_Name)
    ))).toContain("President Chester A. Arthur");
    await expect.poll(() => page.evaluate(() => (
      globalThis.testMap.queryRenderedFeatures({ layers: ["cemetery-road-labels"] })
        .map(({ properties }) => properties.Cemetery_R)
    ))).toContain("South Ridge Road");
    expect(fontRequests).toEqual([]);

    const terrainPixels = await canvasPixels(page);
    await page.getByLabel("Terrain", { exact: true }).uncheck();
    await waitForMap(page);
    const flatPixels = await canvasPixels(page);
    const meanDifference = terrainPixels.reduce((sum, value, index) => (
      index % 4 === 3 ? sum : sum + Math.abs(value - flatPixels[index])
    ), 0) / (120 * 120 * 3);
    expect(meanDifference, "terrain must change the rendered relief, not just its checkbox").toBeGreaterThan(4);
    await page.getByLabel("Terrain", { exact: true }).check();
    await waitForMap(page);
    await testInfo.attach("terrain-and-landmarks", { body: await page.screenshot(), contentType: "image/png" });

    const labelPoint = await page.evaluate(() => {
      const map = globalThis.testMap;
      const center = map.project([-73.73362297435509, 42.707493868452055]);
      for (let y = center.y - 50; y <= center.y + 50; y += 4) {
        for (let x = center.x - 90; x <= center.x + 90; x += 4) {
          const labels = map.queryRenderedFeatures([x, y], { layers: ["cemetery-landmark-labels"] });
          const sections = map.queryRenderedFeatures([x, y], { layers: ["cemetery-sections"] });
          if (labels.some(({ properties }) => properties.Full_Name === "President Chester A. Arthur") &&
            sections.some(({ properties }) => String(properties.Section) === "24")) return { x, y };
        }
      }
      return null;
    });
    expect(labelPoint).not.toBeNull();
    await page.locator(".maplibregl-canvas").click({ position: labelPoint });
    await expect(page.getByRole("group", { name: "Section 24", exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.has("tour")).toBe(false);
    expect(new URL(page.url()).searchParams.has("record")).toBe(false);
    await waitForMap(page);
    const fittedZoom = await page.evaluate(() => globalThis.testMap.getZoom());
    await page.evaluate(() => globalThis.testMap.jumpTo({ center: [-73.73362, 42.70749], zoom: 15.2 }));
    await waitForMap(page);
    const sectionPoint = await page.evaluate(() => {
      const point = globalThis.testMap.project([-73.73362, 42.70749]);
      return { x: point.x, y: point.y };
    });
    await page.locator(".maplibregl-canvas").click({ position: sectionPoint });
    await expect.poll(() => page.evaluate(() => globalThis.testMap.getZoom())).toBeCloseTo(fittedZoom, 1);
    await page.reload();
    await expect(page.getByRole("group", { name: "Section 24", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("a selected tour grave has one marker and restores its record", async ({ page }) => {
  await observeMap(page);
  await page.goto("./?view=map&tour=Notable&record=tour%3ANotable%3A18%3A24%3A8");
  await expect(page.getByRole("heading", { name: "President Chester A. Arthur", exact: true })).toBeVisible();
  await waitForMap(page);
  await expect.poll(() => page.evaluate(() => (
    globalThis.testMap.queryRenderedFeatures({ layers: ["records", "tour-records", "selected-record"] })
      .filter(({ properties }) => properties.id === "tour:Notable:18:24:8").length
  ))).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "President Chester A. Arthur", exact: true })).toBeVisible();
});

test("Section 49 fits every polygon and section numbers remain available with terrain off", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await observeMap(page);
  await page.goto("./?view=map&section=49");
  await expect(page.getByRole("group", { name: "Section 49" })).toBeVisible();
  await waitForMap(page);
  const extent = await page.evaluate(() => {
    const map = globalThis.testMap;
    return {
      corners: [
        [-73.73509052411812, 42.7094728124924],
        [-73.73404733557098, 42.710237901535336],
      ].map((coordinates) => map.project(coordinates)),
      width: map.getContainer().clientWidth,
      height: map.getContainer().clientHeight,
    };
  });
  for (const corner of extent.corners) {
    expect(corner.x).toBeGreaterThanOrEqual(40);
    expect(corner.x).toBeLessThanOrEqual(extent.width - 40);
    expect(corner.y).toBeGreaterThanOrEqual(110);
    expect(corner.y).toBeLessThanOrEqual(extent.height - 50);
  }
  await page.getByLabel("Terrain", { exact: true }).uncheck();
  await expect.poll(() => page.evaluate(() => (
    globalThis.testMap.queryRenderedFeatures({ layers: ["cemetery-section-labels"] })
      .map(({ properties }) => String(properties.Section))
  ))).toContain("49");
  await page.getByRole("button", { name: "View burials" }).click();
  await expect(page.getByLabel("Section", { exact: true })).toHaveValue("49");
  await expect(page.locator(".record-row").first()).toBeVisible();
});
