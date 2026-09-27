import { expect, test } from "@playwright/test";

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
