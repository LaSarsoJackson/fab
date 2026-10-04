import { expect, test } from "@playwright/test";

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
    const response = await page.goto(`${testInfo.project.use.baseURL}support.html`);
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
