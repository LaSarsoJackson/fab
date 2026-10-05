import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("a missed burial search explains the query and how to try again", async ({ page }) => {
  await page.goto("./?view=burials&q=zzzzzzunlikely");
  await expect(page.locator(".locator-results")).toContainText("zzzzzzunlikely");
  await expect(page.locator(".locator-results")).toContainText(/Try fewer letters|last name/);
  await expect(page.locator(".record-row")).toHaveCount(0);
  await page.getByLabel("Name", { exact: true }).fill("smith");
  await expect(page.locator(".record-row").first()).toBeVisible();
  await expect(page.locator(".record-list").locator("xpath=ancestor::*[@aria-live]")).toHaveCount(0);
});

test("a missed section-only search does not print an empty name", async ({ page }) => {
  await page.goto("./?view=burials&section=99999");
  const results = page.locator(".locator-results");
  await expect(results).toContainText("99999");
  await expect(results).toContainText(/No burials/);
  await expect(results).not.toContainText("“”");
  await page.getByLabel("Section", { exact: true }).fill("49");
  await expect(page.locator(".record-row").first()).toBeVisible();
});

test("a failed burial download gives a retry that preserves the search", async ({ page }) => {
  const block = (route) => route.abort();
  await page.route("**/Search_Burials.json*", block);
  await page.goto("./?view=burials&q=smith");
  await expect(page.locator(".locator-results")).toContainText(/isn['’]t available|couldn['’]t load|could not load/);
  await expect(page.locator(".locator-results")).not.toContainText(/TypeError|Failed to fetch|\.js:/);
  await page.unroute("**/Search_Burials.json*", block);
  await page.getByRole("button", { name: /Reload|Try again/ }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("smith");
  await expect(page.locator(".record-row").first()).toBeVisible();
});

test("a person searched in tours can continue in Burial Locator", async ({ page }) => {
  await page.goto("./?view=tours");
  await page.getByLabel("Search tours", { exact: true }).fill("smith");
  await expect(page.locator(".tours-view")).toContainText("To find a person");
  await page.locator(".tours-view").getByRole("button", { name: "Burial Locator", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Burial Locator", exact: true })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("smith");
  await expect(page.locator(".record-row").first()).toBeVisible();
});

test("a missing tour gives a clear way back to the catalogue", async ({ page }) => {
  await page.goto("./?view=map&tour=missing-public-tour");
  const error = page.locator(".map-status--error");
  await expect(error).toContainText(/This tour didn['’]t load/);
  await expect(error).not.toContainText("missing-public-tour");
  await error.getByRole("button", { name: "Search Tours", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Search Tours", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Notables Tour 2020/ }).click();
  await expect(page).toHaveURL(/view=map.*tour=Notable/);
  await expect(page.locator(".map-status--error")).toHaveCount(0);
});
