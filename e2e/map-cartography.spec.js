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

test("credits start collapsed before tiles finish and stay in the bottom-right corner", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await observeMap(page);
  let releaseTiles;
  const pendingTiles = new Promise((resolve) => { releaseTiles = resolve; });
  await page.route("https://services.arcgisonline.com/**", async (route) => {
    await pendingTiles;
    await route.continue();
  });
  await page.goto("./?view=map");
  const attribution = page.locator(".maplibregl-ctrl-attrib");
  await expect(page.getByLabel("Map credits", { exact: true })).toBeVisible();
  await expect(attribution).not.toHaveAttribute("open", "");
  expect(await page.evaluate(() => globalThis.testMap.loaded())).toBe(false);
  releaseTiles();
  await waitForMap(page);
  await expect(attribution).not.toHaveAttribute("open", "");
  await page.setViewportSize({ width: 812, height: 375 });
  await expect(attribution).not.toHaveAttribute("open", "");
  await page.getByLabel("Map credits", { exact: true }).click();
  await expect(attribution).toHaveAttribute("open", "");
  await expect(attribution.getByRole("link", { name: "U.S. Geological Survey" })).toBeVisible();
  await page.getByLabel("Map credits", { exact: true }).click();
  await expect(attribution).not.toHaveAttribute("open", "");
});

for (const width of [375, 1440]) {
  test(`section points offer overlapping burials and clear on a blank tap at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await observeMap(page);
    await page.goto("./?view=map&section=15");
    await expect.poll(async () => Number(await page.locator("[data-visible-marker-count]")
      .getAttribute("data-visible-marker-count"))).toBeGreaterThan(0);
    await waitForMap(page);
    const data = await page.evaluate(() => globalThis.testMap.getSource("records").getData());
    expect(data.features.length).toBe(1150);
    const target = await page.evaluate(() => {
      const map = globalThis.testMap;
      for (const feature of map.queryRenderedFeatures({ layers: ["records"] })) {
        const { x, y } = map.project(feature.geometry.coordinates);
        if (x < 20 || x > map.getContainer().clientWidth - 70 || y < 150 || y > map.getContainer().clientHeight - 50) continue;
        const nearby = map.queryRenderedFeatures([[x - 6, y - 6], [x + 6, y + 6]], { layers: ["records"] });
        const names = [...new Set(nearby.map(({ properties }) => properties.name))];
        if (names.length > 1 && names.length < 20) return { x, y, names };
      }
      return null;
    });
    expect(target).not.toBeNull();
    await testInfo.attach("section-points", { body: await page.screenshot(), contentType: "image/png" });
    await page.locator(".maplibregl-canvas").click({ position: { x: target.x, y: target.y } });
    const picker = page.getByRole("complementary", { name: "Burials at this point" });
    await expect(picker).toBeVisible();
    for (const name of target.names) await expect(picker.getByText(name, { exact: true }).first()).toBeVisible();
    await picker.getByRole("button").nth(2).click();
    await expect(page.getByRole("article")).toBeVisible();
    expect(new URL(page.url()).searchParams.has("record")).toBe(true);
    await waitForMap(page);
    const blank = await page.evaluate(() => {
      const map = globalThis.testMap;
      const canvas = map.getCanvas().getBoundingClientRect();
      for (let y = 140; y < canvas.height - 50; y += 10) {
        for (let x = 20; x < canvas.width - 70; x += 10) {
          if (document.elementFromPoint(canvas.x + x, canvas.y + y) !== map.getCanvas()) continue;
          if (!map.queryRenderedFeatures([[x - 8, y - 8], [x + 8, y + 8]], {
            layers: ["cemetery-sections", "records", "selected-record"],
          }).length) return { x, y };
        }
      }
      return null;
    });
    expect(blank).not.toBeNull();
    await page.locator(".maplibregl-canvas").click({ position: blank });
    await expect(page.getByRole("group", { name: "Section 15" })).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.locator("[data-visible-marker-count]")).toHaveAttribute("data-visible-marker-count", "0");
    expect(new URL(page.url()).searchParams.has("section")).toBe(false);
    await page.goBack();
    await expect(page.getByRole("group", { name: "Section 15" })).toBeVisible();
    await page.getByRole("button", { name: "Clear section", exact: true }).click();
    await expect(page.getByRole("group", { name: "Section 15" })).toHaveCount(0);
  });
}

for (const width of [375, 1440]) {
  test(`terrain and landmark names render without intercepting section taps at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    const externalFontRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/\.pbf(?:\?|$)|\.woff2?(?:\?|$)/.test(request.url()) &&
        new URL(request.url()).origin !== new URL(page.url()).origin) {
        externalFontRequests.push(request.url());
      }
    });
    await observeMap(page);
    await page.goto("./?view=map&section=49");
    await waitForMap(page);
    await page.evaluate(() => globalThis.testMap.jumpTo({ zoom: 16 }));
    await waitForMap(page);
    expect(await page.evaluate(() => globalThis.testMap.queryRenderedFeatures({
      layers: ["cemetery-landmark-labels"],
    }).length)).toBe(0);
    const credits = await page.getByLabel("Map credits", { exact: true }).boundingBox();
    const mapBox = await page.locator(".maplibregl-map").boundingBox();
    expect(mapBox.x + mapBox.width - credits.x - credits.width).toBeLessThanOrEqual(12);
    expect(mapBox.y + mapBox.height - credits.y - credits.height).toBeLessThanOrEqual(12);
    await expect(page.locator(".maplibregl-ctrl-attrib")).not.toHaveAttribute("open", "");
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
    expect(externalFontRequests).toEqual([]);

    const terrainPixels = await canvasPixels(page);
    await page.getByLabel("Basemap", { exact: true }).selectOption("streets");
    await waitForMap(page);
    const flatPixels = await canvasPixels(page);
    const meanDifference = terrainPixels.reduce((sum, value, index) => (
      index % 4 === 3 ? sum : sum + Math.abs(value - flatPixels[index])
    ), 0) / (120 * 120 * 3);
    expect(meanDifference, "terrain must change the rendered relief, not just its checkbox").toBeGreaterThan(4);
    await page.getByLabel("Basemap", { exact: true }).selectOption("terrain");
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
  await page.getByLabel("Basemap", { exact: true }).selectOption("streets");
  await page.getByLabel("Sections", { exact: true }).check();
  await expect.poll(() => page.evaluate(() => (
    globalThis.testMap.queryRenderedFeatures({ layers: ["cemetery-section-labels"] })
      .map(({ properties }) => String(properties.Section))
  ))).toContain("49");
  await page.getByRole("button", { name: "View burials" }).click();
  await expect(page.getByLabel("Section", { exact: true })).toHaveValue("49");
  await expect(page.locator(".record-row").first()).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 720, height: 500 },
  { width: 750, height: 342 },
  { width: 1280, height: 800 },
]) {
  test(`selected grave and Navigate stay visible at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await observeMap(page);
    await page.goto("./?view=map&tour=Notable");
    await waitForMap(page);
    const list = page.getByRole("complementary", { name: "Notables Tour 2020" });
    if (viewport.width < 720) {
      const panel = await list.boundingBox();
      expect(panel.height).toBeLessThanOrEqual(190);
    }
    await list.getByRole("button", { name: /James Hall/ }).click();
    await waitForMap(page);
    await expect(list).toBeHidden();
    const card = await page.getByRole("article", { name: "James Hall" }).boundingBox();
    const pin = await page.evaluate(() => {
      const map = globalThis.testMap;
      const feature = map.querySourceFeatures("selected")[0];
      if (!feature) return null;
      const point = map.project(feature.geometry.coordinates);
      const canvas = map.getCanvas().getBoundingClientRect();
      return { x: canvas.x + point.x, y: canvas.y + point.y };
    });
    expect(pin).not.toBeNull();
    expect(pin.x).toBeGreaterThan(12);
    expect(pin.x).toBeLessThan(viewport.width - 12);
    expect(pin.y).toBeGreaterThan(12);
    expect(pin.y).toBeLessThan(viewport.height - 12);
    expect(pin.x + 12 < card.x || pin.x - 12 > card.x + card.width ||
      pin.y + 12 < card.y || pin.y - 12 > card.y + card.height).toBe(true);
    const navigate = page.getByRole("link", { name: "Navigate", exact: true });
    await expect(navigate).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("link", { name: "Read biography", exact: true }))
      .toBeInViewport({ ratio: 1 });
    const action = await navigate.boundingBox();
    expect(action.y).toBeGreaterThanOrEqual(card.y);
    expect(action.y + action.height).toBeLessThanOrEqual(card.y + card.height);
    await page.locator(".record-card__details").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(navigate).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Close details" })).toBeInViewport({ ratio: 1 });
  });
}
