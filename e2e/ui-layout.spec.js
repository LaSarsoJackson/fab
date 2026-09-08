import { expect, test } from "@playwright/test";

for (const width of [320, 375, 414, 768]) {
  test(`catalogue and burial search remain readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("./?view=tours");
    await page.evaluate(() => document.fonts.ready);

    const sections = page.getByRole("region", { name: "Sections & groups", exact: true });
    const tours = page.getByRole("region", { name: "Tours", exact: true });
    await expect(sections.getByRole("button", { name: /Section 49/ })).toBeVisible();
    await expect(tours.getByRole("button", { name: /Notables Tour 2020/ })).toBeVisible();

    for (const button of await page.locator(".tour-row").all()) {
      const bounds = await button.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    const navigation = page.getByRole("navigation", { name: "Primary" });
    for (const button of await navigation.getByRole("button").all()) {
      await expect(button).toBeInViewport();
    }

    await page.getByLabel("Search tours", { exact: true }).fill("Mayors");
    await expect(page.locator(".tour-row")).toHaveCount(1);
    await expect(tours.getByRole("button", { name: /Mayors of Albany/ })).toBeVisible();
    await expect(sections).toHaveCount(0);

    await page.goto("./?view=burials");
    await expect(page.getByLabel("Section", { exact: true })).toBeInViewport();
    await page.getByLabel("Name", { exact: true }).fill("Hall");
    await expect(page.locator(".record-row").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const result = await page.locator(".record-row").first().boundingBox();
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x + result.width).toBeLessThanOrEqual(width);
  });
}
