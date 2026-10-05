import { expect, test } from "@playwright/test";

const SUPPORT_BASE_URL = `http://127.0.0.1:${Number(process.env.PLAYWRIGHT_APP_PORT || "4173") + 1}/fab/`;
test.use({ baseURL: SUPPORT_BASE_URL });

test("the default map remains available after an offline reload", async ({ page, context }, testInfo) => {
  await page.goto("./");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("service-worker.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  await page.reload();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open("fab-v8");
    return (await cache.keys()).some(request => /\/MapView-[^/]+\.js$/.test(request.url));
  })).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("offline-default-map.png"), fullPage: true });
});

test("visiting help and privacy preserves the offline app", async ({ page, context }, testInfo) => {
  await page.goto("?view=tours");
  await expect(page.getByRole("heading", { name: "Search Tours", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    // Wait for the production worker before warming assets for offline use.
    await navigator.serviceWorker.register("service-worker.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Search Tours", exact: true })).toBeVisible();
  await page.goto("support.html");
  await expect(page.getByRole("heading", { name: "App help", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Privacy policy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.goto("?view=tours");
  await expect(page.getByRole("heading", { name: "Search Tours", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("offline-tours-after-help.png"), fullPage: true });
});

for (const width of [320, 1440]) {
  test(`support and privacy pages work without scripts at ${width}px`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
    const page = await context.newPage();
    const response = await page.goto(`${SUPPORT_BASE_URL}support.html`);
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "App help", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "geo.jrk1@gmail.com", exact: true })).toHaveAttribute("href", "mailto:geo.jrk1@gmail.com");
    await page.getByRole("link", { name: "Privacy policy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Privacy policy", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Location and directions", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "App help", exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`privacy-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: "App help", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`support-${width}.png`), fullPage: true });
    await expect(page.getByRole("link", { name: "Open the cemetery map", exact: true })).toHaveAttribute("href", "./");
    await context.close();
  });
}
